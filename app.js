document.addEventListener('DOMContentLoaded', function() {
    const addActivityBtn = document.getElementById('add-activity-btn');
    const suggestActivityBtn = document.getElementById('suggest-activity-btn');
    const activityForm = document.getElementById('activity-form');
    const suggestForm = document.getElementById('suggest-form');
    const activityList = document.getElementById('activity-list');
    const suggestionResult = document.getElementById('suggestion-result');
    const cancelEditBtn = document.getElementById('cancel-edit');
    const audioFileInput = document.getElementById('audio-file-input');

    let activities = JSON.parse(localStorage.getItem('activities')) || [];
    let editIndex = null;

    // Check if there's a custom reminder sound in localStorage
    let customReminderSound = localStorage.getItem('customReminderSound');

    // Set the initial sound source
    let notificationSound = new Audio(customReminderSound || 'notification.mp3');

    // Function to update the audio source
    function updateNotificationSound(soundFile) {
        notificationSound.src = soundFile;
        localStorage.setItem('customReminderSound', soundFile);
    }
    // Event listener for when a new audio file is selected
    audioFileInput.addEventListener('change', function() {
        const file = this.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const audioSrc = e.target.result;
            updateNotificationSound(audioSrc);
        };

        if (file) {
            reader.readAsDataURL(file);
        }
    });

    function renderActivities() {
        activityList.innerHTML = '';
        activities.forEach((activity, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
          <div>
            <strong>${activity.name}</strong> (${activity.category})<br>
            ${activity.startTime} - ${activity.endTime}
          </div>
          <div>
            <button class="edit" onclick="editActivity(${index})">Edit</button>
            <button class="delete" onclick="deleteActivity(${index})">Delete</button>
          </div>
        `;
            activityList.appendChild(li);
        });
        calculateStatistics();
    }

    window.deleteActivity = function(index) {
        activities.splice(index, 1);
        localStorage.setItem('activities', JSON.stringify(activities));
        renderActivities();
    }

    window.editActivity = function(index) {
        const activity = activities[index];
        document.getElementById('name').value = activity.name;
        document.getElementById('category').value = activity.category;
        document.getElementById('start-time').value = activity.startTime;
        document.getElementById('end-time').value = activity.endTime;
        document.getElementById('reminder-time').value = activity.reminderTime;
        document.getElementById('activity-id').value = index;
        document.getElementById('add-activity').style.display = 'block';
        editIndex = index;
    }

    cancelEditBtn.addEventListener('click', () => {
        activityForm.reset();
        document.getElementById('add-activity').style.display = 'none';
        editIndex = null;
    });

    addActivityBtn.addEventListener('click', () => {
        document.getElementById('add-activity').style.display = 'block';
    });

    suggestActivityBtn.addEventListener('click', () => {
        document.getElementById('suggest-activity').style.display = 'block';
    });

    activityForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const category = document.getElementById('category').value;
        const startTime = document.getElementById('start-time').value;
        const endTime = document.getElementById('end-time').value;
        const reminderTime = document.getElementById('reminder-time').value;

        const newActivity = { name, category, startTime, endTime, reminderTime };

        if (editIndex !== null) {
            activities[editIndex] = newActivity;
            editIndex = null;
        } else {
            activities.push(newActivity);
        }

        localStorage.setItem('activities', JSON.stringify(activities));
        renderActivities();
        scheduleNotification(newActivity);
        activityForm.reset();
        document.getElementById('add-activity').style.display = 'none';
    });

    suggestForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('suggest-name').value;
        const category = document.getElementById('suggest-category').value;
        const duration = parseInt(document.getElementById('suggest-duration').value);

        const suggestion = suggestTime(name, category, duration);
        if (suggestion) {
            suggestionResult.innerHTML = `
          Suggested Time: ${suggestion.start} - ${suggestion.end}
        `;
        } else {
            suggestionResult.innerHTML = 'No available time slot found';
        }
    });

    function scheduleNotification(activity) {
        const startTime = new Date();
        const [hours, minutes] = activity.startTime.split(':');
        startTime.setHours(hours, minutes, 0, 0);

        const reminderTimeInMs = activity.reminderTime * 60 * 1000;
        const notificationTime = new Date(startTime.getTime() - reminderTimeInMs);

        const now = new Date();
        const timeToNotification = notificationTime.getTime() - now.getTime();

        if (timeToNotification > 0) {
            setTimeout(() => {
                showNotification(activity.name);
                notificationSound.play();
            }, timeToNotification);
        }
    }

    function showNotification(activityName) {
        if (Notification.permission === 'granted') {
            new Notification('Reminder', {
                body: `It's time for ${activityName}`,
            });
        }
    }

    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    function calculateStatistics() {
        const statsSummary = document.getElementById('stats-summary');
        const totalActivities = activities.length;
        let totalStudyTime = 0;
        let totalRestTime = 0;
        let totalWorkTime = 0;

        activities.forEach((activity) => {
            const [startHour, startMinute] = activity.startTime.split(':');
            const [endHour, endMinute] = activity.endTime.split(':');
            const startTime = new Date();
            startTime.setHours(startHour, startMinute, 0, 0);
            const endTime = new Date();
            endTime.setHours(endHour, endMinute, 0, 0);
            const duration = (endTime - startTime) / (1000 * 60); // duration in minutes

            if (activity.category.toLowerCase() === 'study') {
                totalStudyTime += duration;
            } else if (activity.category.toLowerCase() === 'rest') {
                totalRestTime += duration;
            } else if (activity.category.toLowerCase() === 'work') {
                totalWorkTime += duration;
            }
        });

        statsSummary.innerHTML = `
        <p>Total Activities: ${totalActivities}</p>
        <p>Total Study Time: ${totalStudyTime} minutes</p>
        <p>Total Rest Time: ${totalRestTime} minutes</p>
        <p>Total Work Time: ${totalWorkTime} minutes</p>
      `;
    }

    function suggestTime(name, category, duration) {
        const freeSlots = getFreeTimeSlots();
        const optimalSlot = freeSlots.find(slot => {
            const slotDuration = (new Date(slot.end) - new Date(slot.start)) / (1000 * 60);
            return slotDuration >= duration;
        });

        if (optimalSlot) {
            const start = new Date(optimalSlot.start);
            const end = new Date(start.getTime() + duration * 60 * 1000);
            const suggestion = { start: start.toTimeString().slice(0, 5), end: end.toTimeString().slice(0, 5) };

            activities.push({ name, category, startTime: suggestion.start, endTime: suggestion.end, reminderTime: 15 });
            localStorage.setItem('activities', JSON.stringify(activities));
            renderActivities();
            scheduleNotification(activities[activities.length - 1]);

            return suggestion;
        }
        return null;
    }

    function getFreeTimeSlots() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dayEnd = new Date(today.getTime());
        dayEnd.setHours(23, 59, 59, 999);

        const sortedActivities = activities.slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
        const freeSlots = [];

        let lastEndTime = today;
        for (const activity of sortedActivities) {
            const startTime = new Date(today);
            const [startHour, startMinute] = activity.startTime.split(':');
            startTime.setHours(startHour, startMinute, 0, 0);

            if (startTime > lastEndTime) {
                freeSlots.push({ start: lastEndTime, end: startTime });
            }

            const endTime = new Date(today);
            const [endHour, endMinute] = activity.endTime.split(':');
            endTime.setHours(endHour, endMinute, 0, 0);
            lastEndTime = endTime;
        }

        if (lastEndTime < dayEnd) {
            freeSlots.push({ start: lastEndTime, end: dayEnd });
        }

        return freeSlots;
    }

    renderActivities();
});