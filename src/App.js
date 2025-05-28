import React, { useState, useEffect, useCallback } from 'react';

// Load Tailwind CSS
// This script will be automatically injected by the Canvas environment.
// <script src="https://cdn.tailwindcss.com"></script>

// Mock Backend Simulation
// This object will simulate our database and user data storage.
// In a real application, this would be a separate server-side database.
const mockDatabase = {
    users: {}, // Stores { email: { passwordHash, userId } }
    userData: {}, // Stores { userId: { tasks: [], notes: [], files: [] } }
};

// Simple hashing function for mock passwords (NOT secure for production)
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    };
    return hash.toString();
};

// Mock JWT generation (for simulation only, NOT secure for production)
const generateToken = (userId) => {
    // A simple base64 encoded string containing user ID and a mock expiry
    return btoa(JSON.stringify({ userId, exp: Date.now() + 3600000 })); // Expires in 1 hour
};

// Mock JWT verification
const verifyToken = (token) => {
    try {
        const decoded = JSON.parse(atob(token));
        if (decoded.exp > Date.now()) {
            return decoded.userId;
        }
    } catch (e) {
        console.error("Token verification failed:", e);
        return null;
    }
    return null;
};

// Mock API functions
// These simulate network requests and database operations.
const mockApi = {
    signup: (email, password) => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (mockDatabase.users[email]) {
                return reject({ status: 409, message: 'User already exists' });
            }
            const userId = `user_${Date.now()}`;
            mockDatabase.users[email] = { passwordHash: simpleHash(password), userId };
            mockDatabase.userData[userId] = { tasks: [], notes: [], files: [] }; // Initialize user data
            resolve({ token: generateToken(userId), message: 'Signed up successfully!' });
        }, 500); // Simulate network delay
    }),
    login: (email, password) => new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = mockDatabase.users[email];
            if (!user || user.passwordHash !== simpleHash(password)) {
                return reject({ status: 401, message: 'Invalid credentials' });
            }
            resolve({ token: generateToken(user.userId), message: 'Logged in successfully!' });
        }, 500); // Simulate network delay
    }),
    fetchData: (userId, dataType) => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!mockDatabase.userData[userId]) {
                // If user data doesn't exist, initialize it (e.g., for new users after login)
                mockDatabase.userData[userId] = { tasks: [], notes: [], files: [] };
            }
            resolve(mockDatabase.userData[userId][dataType] || []);
        }, 300); // Simulate network delay
    }),
    // Generic function to save all data for a type (e.g., all tasks)
    saveAllData: (userId, dataType, data) => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!mockDatabase.userData[userId]) {
                return reject({ status: 404, message: 'User data not found' });
            }
            mockDatabase.userData[userId][dataType] = data;
            resolve({ message: 'Data saved successfully!' });
        }, 300); // Simulate network delay
    }),
    // Specific operations for adding/updating/deleting individual items
    addItem: (userId, dataType, item) => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!mockDatabase.userData[userId]) {
                return reject({ status: 404, message: 'User data not found' });
            }
            const currentData = mockDatabase.userData[userId][dataType] || [];
            const newItem = { ...item, id: item.id || Date.now() }; // Assign a unique ID
            mockDatabase.userData[userId][dataType] = [...currentData, newItem];
            resolve(newItem); // Return the added item with its ID
        }, 300);
    }),
    updateItem: (userId, dataType, itemId, updatedItem) => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!mockDatabase.userData[userId]) {
                return reject({ status: 404, message: 'User data not found' });
            }
            const currentData = mockDatabase.userData[userId][dataType] || [];
            const updatedList = currentData.map(item => item.id === itemId ? { ...item, ...updatedItem } : item);
            mockDatabase.userData[userId][dataType] = updatedList;
            resolve(updatedItem);
        }, 300);
    }),
    deleteItem: (userId, dataType, itemId) => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!mockDatabase.userData[userId]) {
                return reject({ status: 404, message: 'User data not found' });
            }
            const currentData = mockDatabase.userData[userId][dataType] || [];
            const updatedList = currentData.filter(item => item.id !== itemId);
            mockDatabase.userData[userId][dataType] = updatedList;
            resolve({ message: 'Item deleted' });
        }, 300);
    }),
};

// AuthForm Component
const SignInSignUp = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const response = await mockApi.login(email, password);
                localStorage.setItem('authToken', response.token);
                onAuthSuccess(verifyToken(response.token));
            } else {
                const response = await mockApi.signup(email, password);
                localStorage.setItem('authToken', response.token);
                onAuthSuccess(verifyToken(response.token));
            }
        } catch (err) {
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
                <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-8">
                    {isLogin ? 'Sign In' : 'Sign Up'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email:
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            placeholder="your.email@example.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Password:
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            placeholder="********"
                        />
                    </div>
                    {error && <p className="text-red-600 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>
                <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="mt-6 w-full text-blue-600 text-sm hover:underline"
                >
                    {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
                </button>
            </div>
        </div>
    );
};


// EditTaskModal Component
const EditTaskModal = ({ isOpen, onClose, task, onSave }) => {
    const [editText, setEditText] = useState(task?.text || '');
    const [editDate, setEditDate] = useState(task?.date?.slice(0, 10) || '');
    const [editTime, setEditTime] = useState(task?.date?.length > 10 ? task.date.slice(11, 16) : '');
    const [editFrequency, setEditFrequency] = useState(task?.frequency || 'once');
    const [editEndDate, setEditEndDate] = useState(task?.endDate || '');
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    useEffect(() => {
        if (task) {
            setEditText(task.text);
            setEditDate(task.date?.slice(0, 10) || '');
            setEditTime(task.date?.length > 10 ? task.date.slice(11, 16) : '');
            setEditFrequency(task.frequency || 'once');
            setEditEndDate(task.endDate || '');
            setShowEndDatePicker(['daily', 'weekly', 'monthly', 'yearly'].includes(task.frequency) && !!task.endDate);
        }
    }, [task]);

    const handleSave = () => {
        if (editText.trim() && editDate) {
            const newFullDate = editTime ? `${editDate}T${editTime}` : editDate;
            onSave({
                ...task,
                text: editText.trim(),
                date: newFullDate,
                frequency: editFrequency,
                endDate: editFrequency !== 'once' ? editEndDate : '',
            });
            onClose();
        }
    };

    const isRecurring = ['daily', 'weekly', 'monthly', 'yearly'].includes(editFrequency);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Edit Task</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Task Name:</label>
                        <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date (YYYY-MM-DD):</label>
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Time (HH:MM):</label>
                        <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency:</label>
                        <select value={editFrequency} onChange={(e) => {
                            setEditFrequency(e.target.value);
                            if (e.target.value === 'once') {
                                setEditEndDate('');
                                setShowEndDatePicker(false);
                            } else {
                                setShowEndDatePicker(false);
                            }
                        }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                            <option value="once">Once</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>

                    {isRecurring && (
                        <div className="end-date-section">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ends:</label>
                            {showEndDatePicker ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="date"
                                        value={editEndDate}
                                        onChange={(e) => setEditEndDate(e.target.value)}
                                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {editEndDate && (
                                        <button onClick={() => {
                                            setEditEndDate('');
                                            setShowEndDatePicker(false);
                                        }} className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200">Clear</button>
                                    )}
                                </div>
                            ) : (
                                <button onClick={() => setShowEndDatePicker(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200">Set End Date</button>
                            )}
                            {editEndDate && <p className="text-sm text-gray-600 mt-1">Ends on: {new Date(editEndDate).toLocaleDateString()}</p>}
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200">Save</button>
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-200">Cancel</button>
                </div>
            </div>
        </div>
    );
};

// Notes Component
const Notes = ({ notes, setNotes, userId }) => {
    const [openNoteIds, setOpenNoteIds] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState('');

    // Load openNoteIds from local storage (this can remain client-side as it's UI state)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`openNoteIds_${userId}`);
            if (saved) {
                try {
                    setOpenNoteIds(JSON.parse(saved));
                } catch (e) {
                    console.error("Error parsing saved openNoteIds: ", e);
                }
            }
        }
    }, [userId]);

    // Save openNoteIds to local storage
    useEffect(() => {
        if (typeof window !== 'undefined' && userId) {
            localStorage.setItem(`openNoteIds_${userId}`, JSON.stringify(openNoteIds));
        }
    }, [openNoteIds, userId]);

    const toggleNote = (id) => {
        setOpenNoteIds((prevIds) =>
            prevIds.includes(id) ? prevIds.filter((noteId) => noteId !== id) : [...prevIds, id]
        );
    };

    const addNote = async () => {
        if (newNoteContent.trim() !== '') {
            const newNote = {
                id: Date.now(), // Assign an ID immediately for UI
                content: newNoteContent,
            };
            try {
                const addedNote = await mockApi.addItem(userId, 'notes', newNote);
                setNotes((prevNotes) => [...prevNotes, addedNote]);
                setNewNoteContent('');
                toggleNote(addedNote.id); // Open the new note
            } catch (error) {
                console.error('Failed to add note:', error);
            }
        }
    };

    const updateNote = async (id, newContent) => {
        const updatedNotes = notes.map((note) =>
            note.id === id ? { ...note, content: newContent } : note
        );
        setNotes(updatedNotes); // Optimistic UI update
        try {
            await mockApi.updateItem(userId, 'notes', id, { content: newContent });
        } catch (error) {
            console.error('Failed to update note:', error);
            // Revert UI if update fails in a real app
        }
    };

    const deleteNote = async (id) => {
        try {
            await mockApi.deleteItem(userId, 'notes', id);
            setNotes(notes.filter((note) => note.id !== id));
            setOpenNoteIds(openNoteIds.filter((noteId) => noteId !== id)); // Remove from open notes
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    const notesArray = Array.isArray(notes) ? notes : [];

    return (
        <div className="notes-container p-4 bg-white rounded-lg shadow">
            <div className="add-note-form mb-6 flex flex-col space-y-3">
                <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Write a new note..."
                    className="new-note-input w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[80px]"
                />
                <button onClick={addNote} className="add-note-button bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 self-end">Add Note</button>
            </div>
            <div className="notes-list grid gap-4">
                {notesArray.length === 0 && <p className="text-gray-500 text-center">No notes yet. Add one above!</p>}
                {notesArray.map((note) => (
                    <div key={note.id} className="note-card bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
                        <div className="note-header flex justify-between items-center p-3 border-b border-gray-200">
                            <button
                                className="note-title-button text-left font-medium text-gray-700 hover:text-blue-600 transition duration-200 flex-grow"
                                onClick={() => toggleNote(note.id)}
                            >
                                Note {notesArray.indexOf(note) + 1}
                            </button>
                            <button
                                className="delete-note-button text-red-500 hover:text-red-700 transition duration-200"
                                onClick={() => deleteNote(note.id)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        {openNoteIds.includes(note.id) && (
                            <textarea
                                value={note.content}
                                onChange={(e) => updateNote(note.id, e.target.value)}
                                className="note-content w-full p-3 resize-y min-h-[100px] border-t border-gray-200 focus:outline-none focus:ring-0 bg-transparent"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Main TodoApp Component
export default function TodoApp() {
    // Helper to format date as YYYY-MM-DD in AEST timezone
    const toAESTDateStr = (date) => {
        if (!date) return '';
        try {
            return date
                .toLocaleDateString('en-AU', {
                    timeZone: 'Australia/Sydney',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                })
                .split('/')
                .reverse()
                .join('-');
        } catch (error) {
            console.error("Error formatting date", error);
            return '';
        }
    };

    // Authentication States
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    // Data States (now managed by mock backend)
    const [tasks, setTasks] = useState([]);
    const [notes, setNotes] = useState([]);
    const [files, setFiles] = useState([]);

    // UI States
    const [input, setInput] = useState('');
    const [taskDate, setTaskDate] = useState('');
    const [taskTime, setTaskTime] = useState('');
    const [frequency, setFrequency] = useState('once');
    const [taskEndDate, setTaskEndDate] = useState('');
    const [showTaskEndDatePicker, setShowTaskEndDatePicker] = useState(false);
    const [view, setView] = useState('calendar');
    const [menuOpen, setMenuOpen] = useState(false); // Initial state for menu: closed
    const [selectedDate, setSelectedDate] = useState(new Date());

    // File/Folder Management States
    const [currentFolder, setCurrentFolder] = useState(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [fileTitle, setFileTitle] = useState('');
    const [fileDate, setFileDate] = useState(toAESTDateStr(new Date()));

    const [gotoInput, setGotoInput] = useState('');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState(null);

    // Loading Screen States
    const [isLoading, setIsLoading] = useState(true);
    const [showContinueButton, setShowContinueButton] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);

    // Initial check for authentication token on component mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('authToken');
            if (token) {
                const userId = verifyToken(token);
                if (userId) {
                    setIsAuthenticated(true);
                    setCurrentUserId(userId);
                } else {
                    localStorage.removeItem('authToken'); // Token invalid or expired
                }
            }
        }

        // Simulate initial loading screen delay
        const timer = setTimeout(() => {
            setShowContinueButton(true);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    // Fetch user data when authenticated
    useEffect(() => {
        const fetchUserData = async () => {
            if (isAuthenticated && currentUserId) {
                try {
                    const fetchedTasks = await mockApi.fetchData(currentUserId, 'tasks');
                    setTasks(fetchedTasks);
                    const fetchedNotes = await mockApi.fetchData(currentUserId, 'notes');
                    setNotes(fetchedNotes);
                    const fetchedFiles = await mockApi.fetchData(currentUserId, 'files');
                    setFiles(fetchedFiles);
                } catch (error) {
                    console.error('Error fetching user data:', error);
                    // Handle error, e.g., sign out user if data cannot be fetched
                    handleSignOut();
                }
            }
        };
        fetchUserData();
    }, [isAuthenticated, currentUserId]); // Depend on isAuthenticated and currentUserId

    const handleAuthSuccess = (userId) => {
        setIsAuthenticated(true);
        setCurrentUserId(userId);
        setIsLoading(false); // Hide loading screen immediately after auth
    };

    const handleSignOut = () => {
        localStorage.removeItem('authToken');
        setIsAuthenticated(false);
        setCurrentUserId(null);
        setTasks([]);
        setNotes([]);
        setFiles([]);
        setView('calendar'); // Reset view to default
        setMenuOpen(false); // Close menu
        // Re-show loading screen for next sign-in
        setIsLoading(true);
        setShowContinueButton(false);
        setIsFadingOut(false);
        const timer = setTimeout(() => {
            setShowContinueButton(true);
        }, 5000);
        return () => clearTimeout(timer);
    };

    const handleContinue = () => {
        setIsFadingOut(true);
        setTimeout(() => {
            setIsLoading(false);
        }, 500);
    };

    const addTask = async () => {
        if (!input.trim() || !taskDate) return;
        const fullDate = taskTime ? `${taskDate}T${taskTime}` : taskDate;
        const newTask = {
            id: Date.now(), // Assign ID for client-side use before backend confirms
            text: input.trim(),
            date: fullDate,
            frequency,
            endDate: frequency !== 'once' ? taskEndDate : '',
        };

        try {
            const addedTask = await mockApi.addItem(currentUserId, 'tasks', newTask);
            setTasks((prevTasks) => [...prevTasks, addedTask]);
            setInput('');
            setTaskDate('');
            setTaskTime('');
            setFrequency('once');
            setTaskEndDate('');
            setShowTaskEndDatePicker(false);
        } catch (error) {
            console.error('Failed to add task:', error);
        }
    };

    const removeTask = async (idToRemove) => {
        try {
            await mockApi.deleteItem(currentUserId, 'tasks', idToRemove);
            setTasks((prevTasks) => prevTasks.filter((task) => task.id !== idToRemove));
        } catch (error) {
            console.error('Failed to remove task:', error);
        }
    };

    const openEditModal = (task) => {
        setTaskToEdit(task);
        setEditModalOpen(true);
    };

    const saveEditedTask = async (editedTask) => {
        try {
            await mockApi.updateItem(currentUserId, 'tasks', editedTask.id, editedTask);
            setTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === editedTask.id ? editedTask : task
                )
            );
            setTaskToEdit(null);
        } catch (error) {
            console.error('Failed to save edited task:', error);
        }
    };

    // File/Folder Management Functions
    const handleFileUpload = async (e) => {
        const uploadedFiles = Array.from(e.target.files);
        const newFiles = uploadedFiles.map((file, index) => {
            const fileExtension = file.name.split('.').pop();
            const finalFileName = fileTitle.trim() !== ''
                ? `${fileTitle.trim()}.${fileExtension}`
                : file.name;

            return {
                id: `file-${Date.now()}-${index}`,
                name: finalFileName,
                type: 'file',
                src: URL.createObjectURL(file),
                date: fileDate,
                parentId: currentFolder,
            };
        });

        try {
            // Add files one by one to mock API
            for (const file of newFiles) {
                await mockApi.addItem(currentUserId, 'files', file);
            }
            setFiles((prevFiles) => [...prevFiles, ...newFiles]);
            setFileTitle('');
            e.target.value = null;
        } catch (error) {
            console.error('Failed to upload file:', error);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        const newFolder = {
            id: `folder-${Date.now()}`,
            name: newFolderName.trim(),
            type: 'folder',
            parentId: currentFolder,
        };

        try {
            await mockApi.addItem(currentUserId, 'files', newFolder);
            setFiles((prevFiles) => [...prevFiles, newFolder]);
            setNewFolderName('');
        } catch (error) {
            console.error('Failed to create folder:', error);
        }
    };

    const removeFile = async (idToRemove) => {
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

        const itemToRemove = files.find(item => item.id === idToRemove);
        if (!itemToRemove) return;

        const idsToDelete = getAllDescendantIds(idToRemove, files);

        try {
            // Delete items one by one from mock API
            for (const id of idsToDelete) {
                await mockApi.deleteItem(currentUserId, 'files', id);
            }

            // Revoke object URLs for files being deleted
            idsToDelete.forEach(id => {
                const file = files.find(item => item.id === id && item.type === 'file');
                if (file && file.src) {
                    URL.revokeObjectURL(file.src);
                }
            });

            setFiles(prevFiles => prevFiles.filter(item => !idsToDelete.includes(item.id)));
        } catch (error) {
            console.error('Failed to remove file/folder:', error);
        }
    };

    // Memoized tasksByDate calculation for performance
    const tasksByDate = useCallback(() => {
        return tasks.reduce((acc, task) => {
            const startDate = new Date(task.date);
            const endDate = task.endDate ? new Date(task.endDate) : null;
            const taskWithId = { ...task }; // Use task.id directly

            startDate.setHours(0, 0, 0, 0);
            if (endDate) endDate.setHours(0, 0, 0, 0);

            if (task.frequency === 'once') {
                const dateKey = toAESTDateStr(startDate);
                if (!acc[dateKey]) acc[dateKey] = [];
                acc[dateKey].push(taskWithId);
            } else {
                let currentDate = new Date(startDate);
                const startDayOfWeek = startDate.getDay();
                const startDayOfMonth = startDate.getDate();
                const startMonth = startDate.getMonth();

                if (!endDate) {
                    const dateKey = toAESTDateStr(startDate);
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(taskWithId);
                    return acc;
                }

                while (currentDate <= endDate) {
                    let shouldAddTask = false;

                    if (task.frequency === 'daily') {
                        shouldAddTask = true;
                    } else if (task.frequency === 'weekly') {
                        if (currentDate.getDay() === startDayOfWeek) {
                            shouldAddTask = true;
                        }
                    } else if (task.frequency === 'monthly') {
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
                        acc[dateKey].push(taskWithId);
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
            return acc;
        }, {});
    }, [tasks]); // Recalculate only when tasks change

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarDays = [];
    for (let i = 0; i < 35; i++) {
        const dayNum = i - firstDayOfMonth + 1;
        calendarDays.push(dayNum < 1 || dayNum > daysInMonth ? null : new Date(year, month, dayNum));
    }

    const today = toAESTDateStr(new Date());

    const changeMonth = (offset) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setSelectedDate(newDate);
    };

    const handleGoto = () => {
        if (!gotoInput) return;
        const newDate = new Date(gotoInput);
        if (!isNaN(newDate)) setSelectedDate(newDate);
        setGotoInput('');
    };

    const isAddingRecurring = ['daily', 'weekly', 'monthly', 'yearly'].includes(frequency);

    const itemsInCurrentFolder = files.filter(item => item.parentId === currentFolder);

    return (
        <>
            {isLoading ? (
                <div className={`fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white transition-opacity duration-500 ${isFadingOut ? 'opacity-0' : 'opacity-100'} z-[100]`}>
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-8 animate-pulse">"What are you doing today?"</h1>
                    {showContinueButton && (
                        <button className="bg-white text-blue-700 py-3 px-8 rounded-full text-lg font-semibold shadow-lg hover:bg-blue-100 transition duration-300 transform hover:scale-105" onClick={handleContinue}>
                            Continue
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {!isAuthenticated ? (
                        <SignInSignUp onAuthSuccess={handleAuthSuccess} />
                    ) : (
                        <div className="flex h-screen bg-gray-100 font-sans text-gray-800">
                            {/* Side Menu */}
                            <div className={`fixed inset-y-0 left-0 w-64 bg-gray-800 text-white p-6 transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 flex flex-col rounded-r-lg shadow-lg side-menu-custom`}>
                                <button
                                    className="text-2xl font-bold mb-8 text-center text-blue-300 bg-transparent border-none cursor-pointer p-0"
                                    onClick={() => setMenuOpen(!menuOpen)}
                                >
                                    The Organizer
                                </button>
                                <nav className="flex-grow space-y-4">
                                    <button
                                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-2 menu-item-custom"
                                        onClick={() => { setView('calendar'); setMenuOpen(false); }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span>Calendar View</span>
                                    </button>
                                    <button
                                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-2 menu-item-custom"
                                        onClick={() => { setView('files'); setMenuOpen(false); }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                        <span>My Files</span>
                                    </button>
                                    <button
                                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-2 menu-item-custom"
                                        onClick={() => { setView('allTasks'); setMenuOpen(false); }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                        <span>My Task Gallery</span>
                                    </button>
                                    <button
                                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-2 menu-item-custom"
                                        onClick={() => { setView('notes'); setMenuOpen(false); }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        <span>Notes</span>
                                    </button>
                                </nav>
                                <div className="mt-8 pt-4 border-t border-gray-700">
                                    <p className="text-sm text-gray-400 mb-2">User ID: {currentUserId}</p>
                                    <button
                                        className="w-full text-left px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition duration-200 flex items-center space-x-2"
                                        onClick={handleSignOut}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            </div>

                            {/* Removed mobile menu toggle button */}

                            {/* Main Content Area */}
                            <div className="flex-grow p-4 md:p-8 overflow-y-auto">
                                {view === 'calendar' && (
                                    <div className="bg-white p-6 rounded-xl shadow-xl">
                                        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">
                                            The Organizer 📅 - {selectedDate.toLocaleString('default', { month: 'long' })} {year}
                                        </h2>

                                        <div className="add-task-form grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Task Name"
                                                className="col-span-full md:col-span-2 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                                            <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                                            <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                                            <select value={frequency} onChange={(e) => {
                                                setFrequency(e.target.value);
                                                if (e.target.value === 'once') {
                                                    setTaskEndDate('');
                                                    setShowTaskEndDatePicker(false);
                                                } else {
                                                    setShowTaskEndDatePicker(false);
                                                }
                                            }}
                                                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                                <option value="once">Once</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="yearly">Yearly</option>
                                            </select>

                                            {isAddingRecurring && (
                                                <div className="col-span-full flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
                                                    <label className="text-sm font-medium text-gray-700">Ends:</label>
                                                    {showTaskEndDatePicker ? (
                                                        <div className="flex items-center space-x-2 w-full md:w-auto">
                                                            <input
                                                                type="date"
                                                                value={taskEndDate}
                                                                onChange={(e) => setTaskEndDate(e.target.value)}
                                                                className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                            />
                                                            {taskEndDate && (
                                                                <button onClick={() => {
                                                                    setTaskEndDate('');
                                                                    setShowTaskEndDatePicker(false);
                                                                }} className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200">Clear</button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setShowTaskEndDatePicker(true)}
                                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200">Set End Date</button>
                                                    )}
                                                    {taskEndDate && <p className="text-sm text-gray-600 mt-1 md:mt-0">Ends on: {new Date(taskEndDate).toLocaleDateString()}</p>}
                                                </div>
                                            )}

                                            <button onClick={addTask} className="col-span-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200">Add Task</button>
                                        </div>

                                        <div className="nav-buttons flex flex-wrap justify-center gap-3 mb-6">
                                            <button onClick={() => setSelectedDate(new Date())} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200">Go to Today</button>
                                            <div className="flex items-center space-x-2">
                                                <input type="date" value={gotoInput} onChange={(e) => setGotoInput(e.target.value)}
                                                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                                                <button onClick={handleGoto} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200">Go to Date</button>
                                            </div>
                                            <button onClick={() => changeMonth(-1)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200">Prev Month</button>
                                            <button onClick={() => changeMonth(1)} className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200">Next Month</button>
                                        </div>

                                        <div className="calendar-grid grid grid-cols-7 gap-1 md:gap-2 text-sm">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                                <div key={day} className="font-bold text-center py-2 bg-gray-200 rounded-md">{day}</div>
                                            ))}
                                            {calendarDays.map((day, index) => {
                                                if (!day) return <div key={index} className="calendar-cell empty bg-gray-50 rounded-md"></div>;

                                                const formatted = toAESTDateStr(day);
                                                const tasksForDay = tasksByDate()[formatted] || [];

                                                return (
                                                    <div
                                                        key={index}
                                                        className={`calendar-cell p-2 md:p-3 bg-white border border-gray-200 rounded-md shadow-sm min-h-[100px] flex flex-col ${formatted === today ? 'bg-blue-100 border-blue-400' : ''
                                                            } ${formatted === toAESTDateStr(selectedDate) ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                                                    >
                                                        <strong className="text-lg mb-1">{day.getDate()}</strong>

                                                        {tasksForDay.length > 3 ? (
                                                            <details className="text-xs">
                                                                <summary className="cursor-pointer text-blue-600 hover:underline">{tasksForDay.length} tasks</summary>
                                                                <div className="mt-1 space-y-1">
                                                                    {tasksForDay.map((task) => (
                                                                        <div key={task.id} className="task-entry bg-blue-50 p-1 rounded-sm flex flex-col">
                                                                            <span className="font-medium">{task.text}</span>
                                                                            {task.frequency !== 'once' && <span className="text-gray-600 text-xs">({task.frequency})</span>}
                                                                            {task.endDate && <span className="text-gray-600 text-xs">(Ends: {new Date(task.endDate).toLocaleDateString()})</span>}
                                                                            <div className="task-actions flex space-x-1 mt-1">
                                                                                <button onClick={() => openEditModal(task)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                                                                                <button onClick={() => removeTask(task.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </details>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                {tasksForDay.map((task) => (
                                                                    <div key={task.id} className="task-entry bg-blue-50 p-1 rounded-sm flex flex-col">
                                                                        <span className="font-medium">{task.text}</span>
                                                                        {task.frequency !== 'once' && <span className="text-gray-600 text-xs">({task.frequency})</span>}
                                                                        {task.endDate && <span className="text-gray-600 text-xs">(Ends: {new Date(task.endDate).toLocaleDateString()})</span>}
                                                                        <div className="task-actions flex space-x-1 mt-1">
                                                                            <button onClick={() => openEditModal(task)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                                                                            <button onClick={() => removeTask(task.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {view === 'files' && (
                                    <div className="bg-white p-6 rounded-xl shadow-xl">
                                        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">My Files</h2>

                                        {currentFolder && (
                                            <button className="back-button mb-4 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200 flex items-center space-x-2" onClick={() => setCurrentFolder(null)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                                <span>Back to Root</span>
                                            </button>
                                        )}

                                        <div className="add-file-form grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="New Folder Name"
                                                    value={newFolderName}
                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                />
                                                <button onClick={handleCreateFolder} className="mt-2 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200">Create Folder</button>
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="File Title (Optional)"
                                                    value={fileTitle}
                                                    onChange={(e) => setFileTitle(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 mb-2"
                                                />
                                                <input
                                                    type="date"
                                                    value={fileDate}
                                                    onChange={(e) => setFileDate(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 mb-2"
                                                />
                                                <input type="file" onChange={handleFileUpload} multiple
                                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {itemsInCurrentFolder.length === 0 && <p className="col-span-full text-center text-gray-500">No items in this folder.</p>}
                                            {itemsInCurrentFolder.map((item) => (
                                                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col items-center text-center">
                                                    {item.type === 'folder' ? (
                                                        <button onClick={() => setCurrentFolder(item.id)} className="flex flex-col items-center w-full">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 012 2H4a2 2 0 01-2-2V6z" />
                                                            </svg>
                                                            <span className="mt-2 font-medium text-gray-700 truncate w-full">{item.name}</span>
                                                        </button>
                                                    ) : (
                                                        <a href={item.src} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center w-full">
                                                            {item.src && item.src.startsWith('blob:') && (
                                                                <img src={item.src} alt={item.name} className="w-full h-24 object-cover rounded-md mb-2" onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/100x100/eeeeee/333333?text=File"; }} />
                                                            )}
                                                            {!item.src || !item.src.startsWith('blob:') && (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0113 3.414L16.586 7A2 2 0 0118 8.414V16a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm5 2a1 1 0 011-1h.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V15a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1h4z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                            <span className="mt-2 text-sm font-medium text-gray-700 truncate w-full">{item.name}</span>
                                                            <span className="text-xs text-gray-500">{item.date}</span>
                                                        </a>
                                                    )}
                                                    <button onClick={() => removeFile(item.id)} className="mt-2 text-red-500 hover:text-red-700 text-sm">Delete</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {view === 'allTasks' && (
                                    <div className="bg-white p-6 rounded-xl shadow-xl">
                                        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">My Task Gallery</h2>
                                        {tasks.length === 0 && <p className="text-center text-gray-500">No tasks added yet.</p>}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {tasks.map((task) => (
                                                <div key={task.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm flex flex-col">
                                                    <p className="font-semibold text-lg text-blue-800">{task.text}</p>
                                                    <p className="text-sm text-gray-700">Date: {new Date(task.date).toLocaleDateString()}</p>
                                                    {task.date.length > 10 && <p className="text-sm text-gray-700">Time: {new Date(task.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                                                    <p className="text-sm text-gray-700">Frequency: {task.frequency}</p>
                                                    {task.endDate && <p className="text-sm text-gray-700">Ends: {new Date(task.endDate).toLocaleDateString()}</p>}
                                                    <div className="flex space-x-2 mt-3">
                                                        <button onClick={() => openEditModal(task)} className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition duration-200">Edit</button>
                                                        <button onClick={() => removeTask(task.id)} className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm transition duration-200">Delete</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {view === 'notes' && (
                                    <div className="bg-white p-6 rounded-xl shadow-xl">
                                        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">My Notes</h2>
                                        <Notes notes={notes} setNotes={setNotes} userId={currentUserId} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
            {editModalOpen && (
                <EditTaskModal
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    task={taskToEdit}
                    onSave={saveEditedTask}
                />
            )}
        </>
    );
}

