import React, { useState, useEffect, useMemo } from 'react';
import './App.css'; // This line is now uncommented

/**
 * Helper function to format a Date object into a YYYY-MM-DD string in the AEST timezone.
 * This ensures consistency for date comparisons and display.
 * @param {Date} date - The Date object to format.
 * @returns {string} The formatted date string (e.g., "2025-05-28") or an empty string if invalid.
 */
const toAESTDateStr = (date) => {
    if (!date) return '';
    try {
        // Use 'en-AU' locale and 'Australia/Sydney' timezone for AEST
        return date
            .toLocaleDateString('en-AU', {
                timeZone: 'Australia/Sydney',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            })
            .split('/') // Splits "DD/MM/YYYY"
            .reverse() // Reverses to "YYYY", "MM", "DD"
            .join('-'); // Joins to "YYYY-MM-DD"
    } catch (error) {
        console.error("Error formatting date to AEST string:", error);
        return '';
    }
};

/**
 * EditTaskModal Component
 * A modal for editing existing tasks, including task name, date, time, frequency, and end date.
 * @param {boolean} isOpen - Controls the visibility of the modal.
 * @param {function} onClose - Callback function to close the modal.
 * @param {object} task - The task object to be edited.
 * @param {function} onSave - Callback function to save the edited task.
 */
const EditTaskModal = ({ isOpen, onClose, task, onSave }) => {
    // State for task properties being edited
    const [editText, setEditText] = useState(task?.text || '');
    const [editDate, setEditDate] = useState(task?.date?.slice(0, 10) || ''); // YYYY-MM-DD part
    const [editTime, setEditTime] = useState(task?.date?.length > 10 ? task.date.slice(11, 16) : ''); // HH:MM part
    const [editFrequency, setEditFrequency] = useState(task?.frequency || 'once');
    const [editEndDate, setEditEndDate] = useState(task?.endDate || ''); // End date for recurring tasks
    // Controls visibility of the end date picker input
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    // Effect to update modal state when a new task is passed for editing
    useEffect(() => {
        if (task) {
            setEditText(task.text);
            setEditDate(task.date?.slice(0, 10) || '');
            setEditTime(task.date?.length > 10 ? task.date.slice(11, 16) : '');
            setEditFrequency(task.frequency || 'once');
            setEditEndDate(task.endDate || '');
            // Show end date picker if it's a recurring task and an end date is already set
            setShowEndDatePicker(['daily', 'weekly', 'monthly', 'yearly'].includes(task.frequency) && !!task.endDate);
        }
    }, [task]);

    /**
     * Handles saving the edited task.
     * Validates input and calls the onSave callback with the updated task object.
     */
    const handleSave = () => {
        if (editText.trim() && editDate) { // Ensure task text and date are not empty
            const newFullDate = editTime ? `${editDate}T${editTime}` : editDate;
            onSave({
                ...task, // Keep existing task properties (like ID)
                text: editText.trim(),
                date: newFullDate,
                frequency: editFrequency,
                // Only save endDate if the task is recurring, otherwise clear it
                endDate: editFrequency !== 'once' ? editEndDate : '',
            });
            onClose(); // Close the modal after saving
        }
    };

    // Determine if the current frequency is for a recurring task
    const isRecurring = ['daily', 'weekly', 'monthly', 'yearly'].includes(editFrequency);

    if (!isOpen) return null; // Don't render if modal is not open

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Edit Task</h3>
                <label>Task Name:</label>
                <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} />
                <label>Date (YYYY-MM-DD):</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                <label>Time (HH:MM):</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                <label>Frequency:</label>
                <select value={editFrequency} onChange={(e) => {
                    setEditFrequency(e.target.value);
                    // Reset end date and hide picker if frequency changes to 'once'
                    if (e.target.value === 'once') {
                        setEditEndDate('');
                        setShowEndDatePicker(false);
                    } else {
                        // When switching to recurring, initially hide picker to allow "Set End Date" button to show
                        setShowEndDatePicker(false);
                    }
                }}>
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>

                {/* Render end date section only if the task is recurring */}
                {isRecurring && (
                    <div className="end-date-section">
                        <label>Ends:</label>
                        {showEndDatePicker ? ( // If end date picker should be shown
                            <>
                                <input
                                    type="date"
                                    value={editEndDate}
                                    onChange={(e) => setEditEndDate(e.target.value)}
                                />
                                {/* Show "Clear End Date" button only if an end date is set */}
                                {editEndDate && (
                                    <button onClick={() => {
                                        setEditEndDate('');
                                        setShowEndDatePicker(false); // Hide picker, show "Set End Date" button
                                    }}>Clear End Date</button>
                                )}
                            </>
                        ) : ( // Otherwise, show "Set End Date" button
                            <button onClick={() => setShowEndDatePicker(true)}>Set End Date</button>
                        )}
                        {/* Display the selected end date if it exists */}
                        {editEndDate && <p>Ends on: {new Date(editEndDate).toLocaleDateString()}</p>}
                    </div>
                )}

                <div className="modal-buttons">
                    <button onClick={handleSave}>Save</button>
                    <button onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

/**
 * Notes Component
 * Manages a list of user notes, allowing adding, editing, and deleting.
 * Notes are persisted in local storage.
 * @param {Array<object>} notes - The array of note objects.
 * @param {function} setNotes - Setter function for the notes array.
 */
const Notes = ({ notes, setNotes }) => {
    // State to track which notes are currently open (expanded)
    const [openNoteIds, setOpenNoteIds] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('openNoteIds');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [newNoteContent, setNewNoteContent] = useState(''); // State for the new note input

    // Effect to save openNoteIds to local storage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('openNoteIds', JSON.stringify(openNoteIds));
        }
    }, [openNoteIds]);

    /**
     * Toggles the expanded/collapsed state of a note.
     * @param {number} id - The ID of the note to toggle.
     */
    const toggleNote = (id) => {
        setOpenNoteIds((prevIds) =>
            prevIds.includes(id) ? prevIds.filter((noteId) => noteId !== id) : [...prevIds, id]
        );
    };

    /**
     * Adds a new note to the list.
     * The note content is taken from newNoteContent state.
     */
    const addNote = () => {
        if (newNoteContent.trim() !== '') {
            const newNote = {
                id: Date.now(), // Unique ID for the note
                content: newNoteContent,
            };
            setNotes([...notes, newNote]); // Add new note to the list
            setNewNoteContent(''); // Clear input after adding
            toggleNote(newNote.id); // Automatically open the new note
        }
    };

    /**
     * Updates the content of an existing note.
     * @param {number} id - The ID of the note to update.
     * @param {string} newContent - The new content for the note.
     */
    const updateNote = (id, newContent) => {
        const updatedNotes = notes.map((note) =>
            note.id === id ? { ...note, content: newContent } : note
        );
        setNotes(updatedNotes);
    };

    /**
     * Deletes a note from the list.
     * @param {number} id - The ID of the note to delete.
     */
    const deleteNote = (id) => {
        const updatedNotes = notes.filter((note) => note.id !== id);
        setNotes(updatedNotes);
        setOpenNoteIds(openNoteIds.filter((noteId) => noteId !== id)); // Remove from open notes
    };

    // Ensure notes is always treated as an array to prevent errors
    const notesArray = Array.isArray(notes) ? notes : [];

    return (
        <div className="notes-container">
            <div className="add-note-form">
                <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Write a new note..."
                    className="new-note-input"
                />
                <button onClick={addNote} className="add-note-button">Add Note</button>
            </div>
            <div className="notes-list">
                {notesArray.map((note) => (
                    <div key={note.id} className="note-card">
                        <div className="note-header">
                            <button
                                className="note-title-button"
                                onClick={() => toggleNote(note.id)}
                            >
                                Note {notesArray.indexOf(note) + 1} {/* Display note number */}
                            </button>
                            <div className="note-actions">
                                <button
                                    className="delete-note-button"
                                    onClick={() => deleteNote(note.id)}>
                                    Delete
                                </button>
                            </div>
                        </div>
                        {openNoteIds.includes(note.id) && ( // Render textarea only if note is open
                            <textarea
                                value={note.content}
                                onChange={(e) => updateNote(note.id, e.target.value)}
                                className="note-content"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * AuthPage Component
 * Handles user sign-in and sign-up. This is a client-side simulation.
 * In a real application, this would interact with a backend authentication API.
 * @param {function} onAuthSuccess - Callback function to call upon successful authentication.
 */
const AuthPage = ({ onAuthSuccess }) => {
    const [isSignIn, setIsSignIn] = useState(true); // true for sign-in, false for sign-up
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // For sign-up
    const [error, setError] = useState(''); // To display authentication errors

    /**
     * Handles the authentication (sign-in or sign-up) attempt.
     * This is a client-side simulation. In a real app, it would involve API calls.
     * @param {Event} e - The form submission event.
     */
    const handleAuthenticate = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors

        if (isSignIn) {
            // Simulate sign-in
            if (email.trim() && password.trim()) {
                // In a real application, you'd send these credentials to your backend
                // const response = await fetch('/api/signin', { ... });
                // const data = await response.json();
                // if (response.ok) { onAuthSuccess(data); } else { setError(data.message); }

                // For simulation:
                console.log('Simulating sign-in for:', email);
                onAuthSuccess({ userId: email, token: 'dummy_token_123' }); // Pass a dummy user object
            } else {
                setError("Please enter email and password.");
            }
        } else {
            // Simulate sign-up
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
            if (email.trim() && password.trim() && confirmPassword.trim()) {
                // In a real application, you'd send these credentials to your backend
                // const response = await fetch('/api/signup', { ... });
                // const data = await response.json();
                // if (response.ok) { onAuthSuccess(data); } else { setError(data.message); }

                // For simulation:
                console.log('Simulating sign-up for:', email);
                onAuthSuccess({ userId: email, token: 'dummy_token_456' }); // Pass a dummy user object
            } else {
                setError("Please fill all sign-up fields.");
            }
        }
    };

    return (
        <div className="auth-container">
            <h2>{isSignIn ? 'Sign In' : 'Sign Up'}</h2>
            <form onSubmit={handleAuthenticate}>
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {!isSignIn && ( // Only show confirm password for sign-up
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password:</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                )}
                {error && <p className="error-message">{error}</p>} {/* Display error messages */}
                <button type="submit">
                    {isSignIn ? 'Sign In' : 'Sign Up'}
                </button>
            </form>
            <p>
                {isSignIn ? "Don't have an account?" : "Already have an account?"}{' '}
                <button type="button" onClick={() => setIsSignIn(!isSignIn)}>
                    {isSignIn ? 'Sign Up' : 'Sign In'}
                </button>
            </p>
        </div>
    );
};

/**
 * TodoApp Component
 * The main application component, integrating task management, notes, file management,
 * and now, user authentication.
 */
export default function TodoApp() {
    // --- Authentication State ---
    const [user, setUser] = useState(() => {
        // Attempt to load user data from session storage on initial load
        // In a real app, a token might be in an HttpOnly cookie.
        if (typeof window !== 'undefined') {
            const savedUser = sessionStorage.getItem('currentUser');
            return savedUser ? JSON.parse(savedUser) : null;
        }
        return null;
    });

    // --- Core Application States ---
    const [tasks, setTasks] = useState(() => {
        // Load tasks from localStorage, but only if a user is present (or if no user, load default)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('tasks');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [input, setInput] = useState(''); // Task input text
    const [taskDate, setTaskDate] = useState(''); // Task date
    const [taskTime, setTaskTime] = useState(''); // Task time
    const [frequency, setFrequency] = useState('once'); // Task recurrence frequency
    const [taskEndDate, setTaskEndDate] = useState(''); // End date for new recurring tasks
    const [showTaskEndDatePicker, setShowTaskEndDatePicker] = useState(false); // Visibility for new task end date picker
    const [view, setView] = useState('calendar'); // Current view ('calendar', 'files', 'allTasks', 'notes')
    const [menuOpen, setMenuOpen] = useState(false); // State for side menu visibility
    const [selectedDate, setSelectedDate] = useState(new Date()); // Currently selected date in calendar

    // --- File/Folder Management States ---
    const [files, setFiles] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedFiles = localStorage.getItem('myFiles');
            try {
                return savedFiles ? JSON.parse(savedFiles) : [];
            } catch (e) {
                console.error("Error parsing saved files: ", e);
                return [];
            }
        }
        return [];
    });
    const [currentFolder, setCurrentFolder] = useState(null); // null for root, or folder ID
    const [newFolderName, setNewFolderName] = useState(''); // Input for new folder name
    const [fileTitle, setFileTitle] = useState(''); // Input for file name when uploading
    const [fileDate, setFileDate] = useState(toAESTDateStr(new Date())); // Date associated with the file/folder

    // --- Modal and Notes States ---
    const [gotoInput, setGotoInput] = useState(''); // Input for "Go to Date"
    const [editModalOpen, setEditModalOpen] = useState(false); // Visibility for edit task modal
    const [taskToEdit, setTaskToEdit] = useState(null); // Task object currently being edited
    const [notes, setNotes] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedNotes = localStorage.getItem('notes');
            try {
                return savedNotes ? JSON.parse(savedNotes) : [];
            } catch (e) {
                console.error("Error parsing saved notes: ", e);
                return [];
            }
        }
        return [];
    });

    // --- Loading Screen States ---
    const [isLoadingInitial, setIsLoadingInitial] = useState(true); // Initial loading state for the app
    const [showAuthForm, setShowAuthForm] = useState(false); // Controls when the AuthPage is rendered
    const [showContinueButton, setShowContinueButton] = useState(false); // Controls visibility of "Continue" button
    const [isFadingOut, setIsFadingOut] = useState(false); // Controls fade-out animation for loading screen

    // Effect for initial loading screen and "Continue" button timer
    useEffect(() => {
        const timer = setTimeout(() => {
            // After 5 seconds, if no user is logged in, show the authentication form
            if (!user) {
                setShowAuthForm(true);
            }
        }, 5000); // Show AuthPage after 5 seconds if not logged in

        // If a user is already authenticated (e.g., from a previous session),
        // we can bypass the initial loading screen directly to the main app.
        if (user) {
            setIsLoadingInitial(false);
            setShowContinueButton(true); // If already logged in, the continue button is effectively "clicked"
        }

        return () => clearTimeout(timer); // Cleanup timer
    }, [user]); // Rerun if user state changes (e.g., after a successful login)

    /**
     * Handles the "Continue" button click on the loading screen.
     * Initiates the fade-out animation and then hides the loading screen.
     */
    const handleContinue = () => {
        setIsFadingOut(true); // Start fade out animation
        setTimeout(() => {
            setIsLoadingInitial(false); // Hide loading screen after fade
        }, 500); // Match CSS transition duration for fade-out
    };

    // --- Persistence Effects (now dependent on `user` state) ---
    // Save tasks to localStorage whenever tasks or user state changes
    useEffect(() => {
        if (user && typeof window !== 'undefined') { // Only save if a user is logged in
            localStorage.setItem('tasks', JSON.stringify(tasks));
        }
    }, [tasks, user]);

    // Save files to localStorage whenever files or user state changes
    useEffect(() => {
        if (user && typeof window !== 'undefined') { // Only save if a user is logged in
            localStorage.setItem('myFiles', JSON.stringify(files));
        }
    }, [files, user]);

    // Save notes to localStorage whenever notes or user state changes
    useEffect(() => {
        if (user && typeof window !== 'undefined') { // Only save if a user is logged in
            localStorage.setItem('notes', JSON.stringify(Array.isArray(notes) ? notes : []));
        }
    }, [notes, user]);

    // --- Authentication Handlers ---
    /**
     * Callback function for successful authentication from AuthPage.
     * Sets the user state and stores user info in session storage.
     * Triggers fetching user-specific data (simulated here).
     * @param {object} userData - Object containing user ID and token.
     */
    const handleAuthSuccess = (userData) => {
        setUser(userData); // Store user info
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('currentUser', JSON.stringify(userData)); // Save user data
        }
        setShowAuthForm(false); // Hide the auth form
        setShowContinueButton(true); // Make the "Continue" button visible
        console.log("Authentication successful, user data:", userData);
        // In a real app, you would fetch user-specific data from a backend here
        // fetchUserData(userData.userId);
        // For this local storage based app, we just proceed.
    };

    /**
     * Handles user logout.
     * Clears user state, session storage, and all app data from local storage.
     * Resets the app to the initial loading/authentication screen.
     */
    const handleLogout = () => {
        setUser(null); // Clear user state
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('currentUser'); // Clear session storage
            // Clear all app data from local storage
            localStorage.removeItem('tasks');
            localStorage.removeItem('notes');
            localStorage.removeItem('myFiles');
        }
        // Reset app states to empty
        setTasks([]);
        setNotes([]);
        setFiles([]);
        // Reset view to initial loading/auth screen
        setIsLoadingInitial(true);
        setShowAuthForm(false); // Ensure auth form is hidden initially
        setShowContinueButton(false); // Ensure continue button is hidden
        setIsFadingOut(false);
    };

    // --- Task Management Functions ---
    /**
     * Adds a new task to the list.
     * Validates input and creates a new task object.
     */
    const addTask = () => {
        if (!input.trim() || !taskDate) return; // Require task text and date
        const fullDate = taskTime ? `${taskDate}T${taskTime}` : taskDate;
        setTasks([...tasks, {
            text: input.trim(),
            date: fullDate,
            frequency,
            // Only save endDate if the task is recurring, otherwise clear it
            endDate: frequency !== 'once' ? taskEndDate : '',
        }]);
        // Clear input fields after adding task
        setInput('');
        setTaskDate('');
        setTaskTime('');
        setFrequency('once');
        setTaskEndDate('');
        setShowTaskEndDatePicker(false);
    };

    /**
     * Removes a task from the list by its index.
     * @param {number} index - The index of the task to remove.
     */
    const removeTask = (index) => {
        setTasks(prevTasks => prevTasks.filter((_, i) => i !== index));
    };

    /**
     * Opens the Edit Task Modal with the selected task.
     * @param {number} index - The index of the task to edit.
     */
    const openEditModal = (index) => {
        setTaskToEdit(tasks[index]);
        setEditModalOpen(true);
    };

    /**
     * Saves the edited task back into the tasks list.
     * @param {object} editedTask - The updated task object.
     */
    const saveEditedTask = (editedTask) => {
        setTasks(prevTasks =>
            prevTasks.map((task) =>
                task === taskToEdit ? editedTask : task // Replace the original task object with the edited one
            )
        );
        setTaskToEdit(null); // Clear the task being edited
    };

    // --- File/Folder Management Functions ---
    /**
     * Handles file uploads. Creates new file objects and adds them to the files list.
     * @param {Event} e - The file input change event.
     */
    const handleFileUpload = (e) => {
        const uploadedFiles = Array.from(e.target.files);
        const newFiles = uploadedFiles.map((file, index) => {
            const fileExtension = file.name.split('.').pop();
            // Use fileTitle if provided, otherwise fallback to original file name
            const finalFileName = fileTitle.trim() !== ''
                ? `${fileTitle.trim()}.${fileExtension}`
                : file.name;

            return {
                id: `file-${Date.now()}-${index}`, // Unique ID for the file
                name: finalFileName,
                type: 'file',
                src: URL.createObjectURL(file), // Create a URL for local preview/download
                date: fileDate, // Use the date from the input
                parentId: currentFolder, // Associate with the current folder
            };
        });

        setFiles((prevFiles) => [...prevFiles, ...newFiles]); // Add new files to the list
        setFileTitle(''); // Clear file title input after upload
        e.target.value = null; // Clear file input (important for re-uploading same file)
    };

    /**
     * Handles creating a new folder.
     * @returns {void}
     */
    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return; // Require a folder name

        const newFolder = {
            id: `folder-${Date.now()}`, // Unique ID for the folder
            name: newFolderName.trim(),
            type: 'folder',
            parentId: currentFolder, // Associate with the current folder
        };

        setFiles((prevFiles) => [...prevFiles, newFolder]); // Add new folder to the list
        setNewFolderName(''); // Clear folder name input
    };

    /**
     * Removes a file or folder and all its descendants (if it's a folder).
     * Revokes object URLs for deleted files to free up memory.
     * @param {string} idToRemove - The ID of the item to remove.
     */
    const removeFile = (idToRemove) => {
        // Helper recursive function to get all descendant IDs (including subfolders and files within them)
        const getAllDescendantIds = (targetId, allItems) => {
            let ids = [targetId];
            const children = allItems.filter(item => item.parentId === targetId);
            children.forEach(child => {
                if (child.type === 'folder') {
                    ids = ids.concat(getAllDescendantIds(child.id, allItems));
                } else {
                    ids.push(child.id);
                }
            });
            return ids;
        };

        setFiles(prevFiles => {
            const itemToRemove = prevFiles.find(item => item.id === idToRemove);
            if (!itemToRemove) return prevFiles; // Item not found, return original array

            const idsToDelete = getAllDescendantIds(idToRemove, prevFiles);

            // Revoke object URLs for all files being deleted to free up memory
            idsToDelete.forEach(id => {
                const file = prevFiles.find(item => item.id === id && item.type === 'file');
                if (file && file.src) {
                    URL.revokeObjectURL(file.src);
                }
            });

            // Filter out all items whose IDs are in the idsToDelete list
            return prevFiles.filter(item => !idsToDelete.includes(item.id));
        });
    };

    // --- Calendar & Date Functions ---
    // Memoized tasksByDate to avoid re-calculating on every render
    const tasksByDate = useMemo(() => {
        return tasks.reduce((acc, task, i) => {
            const startDate = new Date(task.date);
            const endDate = task.endDate ? new Date(task.endDate) : null;
            const taskWithIndex = { ...task, index: i }; // Add original index for editing/deleting

            // Normalize dates to start of day for accurate comparison
            startDate.setHours(0, 0, 0, 0);
            if (endDate) endDate.setHours(0, 0, 0, 0);

            // If it's a 'once' task, just add it to its specific date
            if (task.frequency === 'once') {
                const dateKey = toAESTDateStr(startDate);
                if (!acc[dateKey]) acc[dateKey] = [];
                acc[dateKey].push(taskWithIndex);
            } else {
                // For recurring tasks, iterate through the dates
                let currentDate = new Date(startDate);
                const startDayOfWeek = startDate.getDay(); // 0 for Sunday, 6 for Saturday
                const startDayOfMonth = startDate.getDate();
                const startMonth = startDate.getMonth();

                // If no end date is provided for a recurring task, it only shows on its start date
                if (!endDate) {
                    const dateKey = toAESTDateStr(startDate);
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(taskWithIndex);
                    return acc; // Move to the next task
                }

                // Loop from start date to end date (inclusive)
                while (currentDate <= endDate) {
                    let shouldAddTask = false;

                    if (task.frequency === 'daily') {
                        shouldAddTask = true;
                    } else if (task.frequency === 'weekly') {
                        if (currentDate.getDay() === startDayOfWeek) {
                            shouldAddTask = true;
                        }
                    } else if (task.frequency === 'monthly') {
                        // Handle monthly recurrence, considering months with different day counts
                        const lastDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                        const lastDayOfStartMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();

                        if (currentDate.getDate() === startDayOfMonth ||
                            (startDayOfMonth > lastDayOfCurrentMonth && currentDate.getDate() === lastDayOfCurrentMonth) ||
                            (startDayOfMonth === lastDayOfStartMonth && currentDate.getDate() === lastDayOfCurrentMonth)
                        ) {
                            shouldAddTask = true;
                        }
                    } else if (task.frequency === 'yearly') {
                        if (currentDate.getMonth() === startMonth && currentDate.getDate() === startDayOfMonth) {
                            shouldAddTask = true;
                        }
                    }

                    if (shouldAddTask) {
                        const dateKey = toAESTDateStr(currentDate);
                        if (!acc[dateKey]) acc[dateKey] = [];
                        acc[dateKey].push(taskWithIndex);
                    }

                    // Move to the next day
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
            return acc;
        }, {});
    }, [tasks]); // Recalculate only when tasks array changes

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 for Sunday, 6 for Saturday
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // Number of days in the current month

    const calendarDays = [];
    // Populate calendar grid with days (including empty cells for padding)
    for (let i = 0; i < 35; i++) { // 5 rows * 7 days = 35 cells (enough for most months)
        const dayNum = i - firstDayOfMonth + 1;
        calendarDays.push(dayNum < 1 || dayNum > daysInMonth ? null : new Date(year, month, dayNum));
    }

    const today = toAESTDateStr(new Date()); // Get today's date in AEST format

    /**
     * Changes the displayed month in the calendar.
     * @param {number} offset - -1 for previous month, 1 for next month.
     */
    const changeMonth = (offset) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setSelectedDate(newDate);
    };

    /**
     * Handles "Go to Date" input. Navigates the calendar to the specified date.
     */
    const handleGoto = () => {
        if (!gotoInput) return;
        const newDate = new Date(gotoInput);
        if (!isNaN(newDate.getTime())) setSelectedDate(newDate); // Check for valid date
        setGotoInput(''); // Clear input
    };

    // Determine if the currently selected frequency for adding a task is recurring
    const isAddingRecurring = ['daily', 'weekly', 'monthly', 'yearly'].includes(frequency);

    // Filter files/folders for the current folder view
    const itemsInCurrentFolder = files.filter(item => item.parentId === currentFolder);

    return (
        <>
            {/* Conditional rendering for Loading Screen / Auth Page / Main App */}
            {isLoadingInitial && !user ? ( // Show loading screen if no user is authenticated
                <div className={`loading-screen ${isFadingOut ? 'fade-out' : ''}`}>
                    <h1 className="loading-text">"What are you doing today?"</h1>
                    {showAuthForm && !user && ( // Render AuthPage after delay if no user is logged in
                        <AuthPage onAuthSuccess={handleAuthSuccess} />
                    )}
                    {showContinueButton && user && ( // Render Continue button only if user is logged in
                        <button className="continue-button" onClick={handleContinue}>
                            Continue
                        </button>
                    )}
                </div>
            ) : ( // Render main application if a user is authenticated (or after loading screen if no auth)
                <div className="app-container">
                    {/* Top bar for user info and logout button */}
                    <div className="top-bar">
                        {/* Removed "Logged in as: {user.userId}" text as per request */}
                        <button className="logout-button" onClick={handleLogout}>Logout</button>
                    </div>

                    {/* Menu toggle button for mobile */}
                    <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                        ☰
                    </button>

                    {/* Side Menu */}
                    <div className={`side-menu ${menuOpen ? 'open' : ''}`}>
                        <button
                            onClick={() => {
                                setView('calendar');
                                setMenuOpen(false);
                            }}
                        >
                            Calendar View
                        </button>
                        <button
                            onClick={() => {
                                setView('files');
                                setMenuOpen(false);
                            }}
                        >
                            My Files
                        </button>
                        <button
                            onClick={() => {
                                setView('allTasks');
                                setMenuOpen(false);
                            }}
                        >
                            My Task Gallery
                        </button>
                        <button
                            onClick={() => {
                                setView('notes');
                                setMenuOpen(false);
                            }}
                        >
                            Notes
                        </button>
                    </div>

                    {/* Main Content View */}
                    <div className="main-view">
                        {view === 'calendar' && (
                            <>
                                <h2>
                                    The Organizer 📅 - {selectedDate.toLocaleString('default', { month: 'long' })} {year}
                                </h2>

                                {/* Add Task Form */}
                                <div className="add-task-form">
                                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Task" />
                                    <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} />
                                    <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
                                    <select value={frequency} onChange={(e) => {
                                        setFrequency(e.target.value);
                                        if (e.target.value === 'once') {
                                            setTaskEndDate('');
                                            setShowTaskEndDatePicker(false);
                                        } else {
                                            setShowTaskEndDatePicker(false);
                                        }
                                    }}>
                                        <option value="once">Once</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>

                                    {/* End Date Picker for Recurring Tasks */}
                                    {isAddingRecurring && (
                                        <div className="end-date-section">
                                            <label>Ends:</label>
                                            {showTaskEndDatePicker ? (
                                                <>
                                                    <input
                                                        type="date"
                                                        value={taskEndDate}
                                                        onChange={(e) => setTaskEndDate(e.target.value)}
                                                    />
                                                    {taskEndDate && (
                                                        <button onClick={() => {
                                                            setTaskEndDate('');
                                                            setShowTaskEndDatePicker(false);
                                                        }}>Clear End Date</button>
                                                    )}
                                                </>
                                            ) : (
                                                <button onClick={() => setShowTaskEndDatePicker(true)}>Set End Date</button>
                                            )}
                                            {taskEndDate && <p>Ends on: {new Date(taskEndDate).toLocaleDateString()}</p>}
                                        </div>
                                    )}

                                    <button onClick={addTask}>Add</button>
                                </div>

                                {/* Calendar Navigation Buttons */}
                                <div className="nav-buttons">
                                    <button onClick={() => setSelectedDate(new Date())}>Go to Today</button>
                                    <input type="date" value={gotoInput} onChange={(e) => setGotoInput(e.target.value)} />
                                    <button onClick={handleGoto}>Go to Date</button>
                                    <button onClick={() => changeMonth(-1)}>Prev Month</button>
                                    <button onClick={() => changeMonth(1)}>Next Month</button>
                                </div>

                                {/* Calendar Grid */}
                                <div className="calendar-grid">
                                    {calendarDays.map((day, index) => {
                                        if (!day) return <div key={index} className="calendar-cell empty"></div>;

                                        const formatted = toAESTDateStr(day);
                                        const tasksForDay = tasksByDate[formatted] || [];

                                        return (
                                            <div
                                                key={index}
                                                className={`calendar-cell ${formatted === today ? 'today' : ''
                                                    } ${formatted === toAESTDateStr(selectedDate) ? 'selected' : ''}`}
                                            >
                                                <strong>{day.getDate()}</strong>

                                                {/* Display tasks for the day, with a "details" summary if more than 3 */}
                                                {tasksForDay.length > 3 ? (
                                                    <details>
                                                        <summary>{tasksForDay.length} tasks</summary>
                                                        {tasksForDay.map((task) => (
                                                            <div key={task.index} className="task-entry">
                                                                {task.text} {task.frequency && `(${task.frequency})`}
                                                                {task.endDate && ` (Ends: ${new Date(task.endDate).toLocaleDateString()})`}
                                                                <div className="task-actions">
                                                                    <button onClick={() => openEditModal(task.index)}>Edit</button>
                                                                    <button onClick={() => removeTask(task.index)}>Delete</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </details>
                                                ) : (
                                                    tasksForDay.map((task) => (
                                                        <div key={task.index} className="task-entry">
                                                            {task.text} {task.frequency && `(${task.frequency})`}
                                                            {task.endDate && ` (Ends: ${new Date(task.endDate).toLocaleDateString()})`}
                                                            <div className="task-actions">
                                                                <button onClick={() => openEditModal(task.index)}>Edit</button>
                                                                <button onClick={() => removeTask(task.index)}>Delete</button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {view === 'files' && (
                            <div>
                                <h2>My Files</h2>

                                {/* Breadcrumbs for navigation */}
                                {currentFolder && (
                                    <button className="back-button" onClick={() => setCurrentFolder(null)}>← Back to Root</button>
                                )}

                                {/* Add New Folder Form */}
                                <div className="add-file-form">
                                    <input
                                        type="text"
                                        placeholder="New Folder Name"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                    />
                                    <button onClick={handleCreateFolder}>Create Folder</button>
                                </div>

                                {/* Add New File Form */}
                                <div className="add-file-form">
                                    <input
                                        type="text"
                                        placeholder="File Title (Optional)"
                                        value={fileTitle}
                                        onChange={(e) => setFileTitle(e.target.value)}
                                    />
                                    <input
                                        type="date"
                                        value={fileDate}
                                        onChange={(e) => setFileDate(e.target.value)}
                                    />
                                    <input
                                        type="file"
                                        onChange={handleFileUpload}
                                        multiple // Allow multiple file selection
                                    />
                                </div>

                                {/* File/Folder Grid */}
                                <div className="file-grid">
                                    {itemsInCurrentFolder.map((item) => (
                                        <div key={item.id} className={`file-item ${item.type}`}>
                                            {item.type === 'folder' ? (
                                                <button className="folder-name" onClick={() => setCurrentFolder(item.id)}>
                                                    📁 {item.name}
                                                </button>
                                            ) : (
                                                <>
                                                    <a href={item.src} download={item.name} target="_blank" rel="noopener noreferrer">
                                                        📄 {item.name}
                                                    </a>
                                                    {item.date && <p className="file-date">Date: {item.date}</p>}
                                                </>
                                            )}
                                            <button className="delete-file-button" onClick={() => removeFile(item.id)}>Delete</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {view === 'allTasks' && (
                            <div>
                                <h2>My Task Gallery</h2>
                                <div className="task-gallery-list">
                                    {tasks.map((task, index) => (
                                        <div key={index} className="task-entry">
                                            {task.text} - {new Date(task.date).toLocaleDateString()}
                                            {task.time && ` at ${task.time}`}
                                            {task.frequency && ` (${task.frequency})`}
                                            {task.endDate && ` (Ends: ${new Date(task.endDate).toLocaleDateString()})`}
                                            <div className="task-actions">
                                                <button onClick={() => openEditModal(index)}>Edit</button>
                                                <button onClick={() => removeTask(index)}>Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {view === 'notes' && (
                            <Notes notes={notes} setNotes={setNotes} />
                        )}

                    </div>
                    {/* Edit Task Modal */}
                    <EditTaskModal
                        isOpen={editModalOpen}
                        onClose={() => setEditModalOpen(false)}
                        task={taskToEdit}
                        onSave={saveEditedTask}
                    />
                </div>
            )}
        </>
    );
}
