import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    collection,
    query,
    where,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
} from 'firebase/firestore';

// Tailwind CSS is assumed to be available, so we just need the classes.

// --- Firebase Configuration and Context ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
            }
            setLoadingAuth(false);
        });

        // Attempt to sign in with custom token if available, or anonymously
        const initialSignIn = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                    console.log("Signed in with custom token.");
                } else {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously.");
                }
            } catch (error) {
                console.error("Firebase initial sign-in error:", error);
                setAuthError(error.message);
                setLoadingAuth(false); // Ensure loading is false even on error
            }
        };

        initialSignIn();

        return () => unsubscribe(); // Cleanup auth listener
    }, []);

    const signUp = async (email, password) => {
        setAuthError(null);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            return true;
        } catch (error) {
            console.error("Error signing up:", error);
            setAuthError(error.message);
            return false;
        }
    };

    const signIn = async (email, password) => {
        setAuthError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            return true;
        } catch (error) {
            console.error("Error signing in:", error);
            setAuthError(error.message);
            return false;
        }
    };

    const signOutUser = async () => {
        setAuthError(null);
        try {
            await signOut(auth);
            // Optionally, clear local data here if not handled by onSnapshot
        } catch (error) {
            console.error("Error signing out:", error);
            setAuthError(error.message);
        }
    };

    return (
        <AuthContext.Provider value={{ currentUser, loadingAuth, authError, signUp, signIn, signOutUser }}>
            {children}
        </AuthContext.Provider>
    );
};

// --- LLM API Call Utility ---
const callGeminiApi = async (prompt, responseSchema = null) => {
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });

    const payload = { contents: chatHistory };
    if (responseSchema) {
        payload.generationConfig = {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        };
    }

    const apiKey = ""; // Canvas will automatically provide this in runtime
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API error response:", errorData);
            throw new Error(`Gemini API request failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            if (responseSchema) {
                try {
                    return JSON.parse(text);
                } catch (jsonError) {
                    console.error("Failed to parse JSON from Gemini API:", text, jsonError);
                    throw new Error("Failed to parse structured response from AI.");
                }
            }
            return text;
        } else {
            console.warn("Gemini API response structure unexpected:", result);
            throw new Error("No content received from AI.");
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw error;
    }
};

// --- Reusable LLM Response Modal ---
const LLMResponseModal = ({ isOpen, onClose, title, content, onAddAsTasks = null }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg space-y-4">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{title}</h3>
                <div className="max-h-96 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                    {Array.isArray(content) ? (
                        <ul className="list-disc list-inside space-y-1">
                            {content.map((item, index) => (
                                <li key={index} className="text-gray-700">{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-700 whitespace-pre-wrap">{content}</p>
                    )}
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    {onAddAsTasks && Array.isArray(content) && content.length > 0 && (
                        <button
                            onClick={() => onAddAsTasks(content)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg transition duration-300 transform hover:scale-105 shadow-md"
                        >
                            Add All as New Tasks
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold py-2 px-5 rounded-lg transition duration-300 transform hover:scale-105 shadow-md"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Sign In / Sign Up Component ---
const AuthScreen = () => {
    const { signUp, signIn, authError } = useContext(AuthContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true); // true for login, false for signup
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        let success;
        if (isLogin) {
            success = await signIn(email, password);
            if (success) {
                setMessage('Signed in successfully!');
            } else {
                setMessage('Sign-in failed. Please check your credentials.');
            }
        } else {
            success = await signUp(email, password);
            if (success) {
                setMessage('Account created! Please sign in.');
                setIsLogin(true); // Switch to login after successful signup
            } else {
                setMessage('Sign-up failed. User might already exist or password is too weak.');
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
                    {isLogin ? 'Sign In' : 'Sign Up'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="email">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200"
                            placeholder="your@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
                    {message && <p className="text-green-600 text-sm text-center">{message}</p>}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300 transform hover:scale-105 shadow-md"
                    >
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-semibold transition duration-200"
                    >
                        {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- EditTaskModal Component ---
const EditTaskModal = ({ isOpen, onClose, task, onSave, onSuggestSubtasks }) => {
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
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md space-y-4">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Edit Task</h3>
                <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2">Task Name:</label>
                    <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
                <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2">Date (YYYY-MM-DD):</label>
                    <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
                <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2">Time (HH:MM):</label>
                    <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
                <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2">Frequency:</label>
                    <select
                        value={editFrequency}
                        onChange={(e) => {
                            setEditFrequency(e.target.value);
                            if (e.target.value === 'once') {
                                setEditEndDate('');
                                setShowEndDatePicker(false);
                            } else {
                                setShowEndDatePicker(false);
                            }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        <option value="once">Once</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>

                {isRecurring && (
                    <div className="end-date-section mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <label className="block text-gray-700 text-sm font-semibold mb-2">Ends:</label>
                        {showEndDatePicker ? (
                            <>
                                <input
                                    type="date"
                                    value={editEndDate}
                                    onChange={(e) => setEditEndDate(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                                {editEndDate && (
                                    <button
                                        onClick={() => {
                                            setEditEndDate('');
                                            setShowEndDatePicker(false);
                                        }}
                                        className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                                    >
                                        Clear End Date
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                onClick={() => setShowEndDatePicker(true)}
                                className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200"
                            >
                                Set End Date
                            </button>
                        )}
                        {editEndDate && <p className="mt-2 text-sm text-gray-600">Ends on: {new Date(editEndDate).toLocaleDateString()}</p>}
                    </div>
                )}

                <div className="modal-buttons flex justify-between space-x-3 mt-6">
                    <button
                        onClick={() => onSuggestSubtasks(editText)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-5 rounded-lg transition duration-300 transform hover:scale-105 shadow-md flex items-center justify-center gap-2"
                        disabled={!editText.trim()}
                    >
                        ✨ Suggest Sub-tasks
                    </button>
                    <div className="flex space-x-3">
                        <button
                            onClick={handleSave}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg transition duration-300 transform hover:scale-105 shadow-md"
                        >
                            Save
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-gray-400 hover:bg-gray-500 text-gray-800 font-bold py-2 px-5 rounded-lg transition duration-300 transform hover:scale-105 shadow-md"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Notes Component ---
const Notes = ({ notes, setNotes, userId, onSummarizeNote }) => {
    const [openNoteIds, setOpenNoteIds] = useState([]);
    const [newNoteContent, setNewNoteContent] = useState('');

    // Fetch notes from Firestore on component mount and userId change
    useEffect(() => {
        if (!userId) return;

        const notesRef = collection(db, `artifacts/${appId}/users/${userId}/data/notes`);
        const unsubscribe = onSnapshot(notesRef, (snapshot) => {
            const fetchedNotes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setNotes(fetchedNotes);
        }, (error) => {
            console.error("Error fetching notes:", error);
        });

        return () => unsubscribe(); // Cleanup listener
    }, [userId, setNotes]);

    const toggleNote = (id) => {
        setOpenNoteIds((prevIds) =>
            prevIds.includes(id) ? prevIds.filter((noteId) => noteId !== id) : [...prevIds, id]
        );
    };

    const addNote = async () => {
        if (newNoteContent.trim() !== '') {
            try {
                const notesRef = collection(db, `artifacts/${appId}/users/${userId}/data/notes`);
                const newNoteDoc = await addDoc(notesRef, {
                    content: newNoteContent.trim(),
                    createdAt: new Date().toISOString(),
                });
                setNewNoteContent('');
                toggleNote(newNoteDoc.id); // Open the newly added note
            } catch (error) {
                console.error("Error adding note:", error);
            }
        }
    };

    const updateNote = async (id, newContent) => {
        try {
            const noteDocRef = doc(db, `artifacts/${appId}/users/${userId}/data/notes`, id);
            await updateDoc(noteDocRef, { content: newContent });
        } catch (error) {
            console.error("Error updating note:", error);
        }
    };

    const deleteNote = async (id) => {
        try {
            const noteDocRef = doc(db, `artifacts/${appId}/users/${userId}/data/notes`, id);
            await deleteDoc(noteDocRef);
            setOpenNoteIds(openNoteIds.filter((noteId) => noteId !== id)); // Remove from open notes
        } catch (error) {
            console.error("Error deleting note:", error);
        }
    };

    const notesArray = Array.isArray(notes) ? notes : [];

    return (
        <div className="notes-container p-6 bg-white rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">My Notes</h2>
            <div className="add-note-form mb-6 flex flex-col sm:flex-row gap-3">
                <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Write a new note..."
                    className="new-note-input flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y min-h-[80px]"
                />
                <button onClick={addNote} className="add-note-button bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 shadow-md">
                    Add Note
                </button>
            </div>
            <div className="notes-list grid gap-4">
                {notesArray.length === 0 && <p className="text-center text-gray-500">No notes yet. Add one above!</p>}
                {notesArray.map((note) => (
                    <div key={note.id} className="note-card bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="note-header flex justify-between items-center mb-3">
                            <button
                                className="note-title-button text-lg font-semibold text-gray-700 hover:text-purple-600 transition duration-200"
                                onClick={() => toggleNote(note.id)}
                            >
                                Note {notesArray.indexOf(note) + 1}
                            </button>
                            <div className="note-actions flex gap-2">
                                <button
                                    onClick={() => onSummarizeNote(note.content)}
                                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-1.5 px-3 rounded-lg transition duration-200 flex items-center justify-center gap-1"
                                    disabled={!note.content.trim()}
                                >
                                    ✨ Summarize
                                </button>
                                <button
                                    className="delete-note-button bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1.5 px-3 rounded-lg transition duration-200"
                                    onClick={() => deleteNote(note.id)}>
                                    Delete
                                </button>
                            </div>
                        </div>
                        {openNoteIds.includes(note.id) && (
                            <textarea
                                value={note.content}
                                onChange={(e) => updateNote(note.id, e.target.value)}
                                className="note-content w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y min-h-[100px]"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main TodoApp Component ---
export default function TodoApp() {
    const { currentUser, loadingAuth, signOutUser } = useContext(AuthContext);
    const userId = currentUser?.uid;

    // Helper to format date as YYYY-MM-DD in AEST timezone
    const toAESTDateStr = (date) => {
        if (!date) return '';
        try {
            // Ensure date is a valid Date object
            const d = new Date(date);
            if (isNaN(d.getTime())) {
                console.warn("Invalid date provided to toAESTDateStr:", date);
                return '';
            }
            return d
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

    const [tasks, setTasks] = useState([]);
    const [input, setInput] = useState('');
    const [taskDate, setTaskDate] = useState('');
    const [taskTime, setTaskTime] = useState('');
    const [frequency, setFrequency] = useState('once');
    const [taskEndDate, setTaskEndDate] = useState('');
    const [showTaskEndDatePicker, setShowTaskEndDatePicker] = useState(false);
    const [view, setView] = useState('calendar');
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [files, setFiles] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [fileTitle, setFileTitle] = useState('');
    const [fileDate, setFileDate] = useState(toAESTDateStr(new Date()));

    const [gotoInput, setGotoInput] = useState('');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState(null);
    const [notes, setNotes] = useState([]);

    const [isLoading, setIsLoading] = useState(true);
    const [showContinueButton, setShowContinueButton] = useState(false);
    const [isFadingOut, setIsFadingOut] = useState(false);

    // LLM states
    const [llmResponseModalOpen, setLlmResponseModalOpen] = useState(false);
    const [llmResponseTitle, setLlmResponseTitle] = useState('');
    const [llmResponseContent, setLlmResponseContent] = useState('');
    const [llmLoading, setLlmLoading] = useState(false);
    const [llmError, setLlmError] = useState(null);

    // --- Loading Screen Effect ---
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowContinueButton(true);
        }, 3000); // Reduced to 3 seconds for faster testing

        return () => clearTimeout(timer);
    }, []);

    const handleContinue = () => {
        setIsFadingOut(true);
        setTimeout(() => {
            setIsLoading(false);
        }, 500);
    };

    // --- Firestore Data Loading (Tasks, Files) ---
    useEffect(() => {
        if (!userId) {
            setTasks([]);
            setFiles([]);
            setNotes([]);
            return;
        }

        // Tasks Listener
        const tasksRef = collection(db, `artifacts/${appId}/users/${userId}/data/tasks`);
        const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => ({
                id: doc.id, // Store Firestore document ID
                ...doc.data(),
            }));
            setTasks(fetchedTasks);
        }, (error) => {
            console.error("Error fetching tasks:", error);
        });

        // Files Listener
        const filesRef = collection(db, `artifacts/${appId}/users/${userId}/data/files`);
        const unsubscribeFiles = onSnapshot(filesRef, (snapshot) => {
            const fetchedFiles = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setFiles(fetchedFiles);
        }, (error) => {
            console.error("Error fetching files:", error);
        });

        // Notes are handled by the Notes component directly

        return () => {
            unsubscribeTasks();
            unsubscribeFiles();
        }; // Cleanup listeners
    }, [userId]); // Re-run when userId changes (on sign-in/out)

    // --- Task Management Functions (Firestore) ---
    const addTask = async () => {
        if (!input.trim() || !taskDate) return;
        if (!userId) {
            console.warn("Cannot add task: User not authenticated.");
            return;
        }

        const fullDate = taskTime ? `${taskDate}T${taskTime}` : taskDate;
        try {
            const tasksRef = collection(db, `artifacts/${appId}/users/${userId}/data/tasks`);
            await addDoc(tasksRef, {
                text: input.trim(),
                date: fullDate,
                frequency,
                endDate: frequency !== 'once' ? taskEndDate : '',
                createdAt: new Date().toISOString(), // Timestamp for ordering
            });
            setInput('');
            setTaskDate('');
            setTaskTime('');
            setFrequency('once');
            setTaskEndDate('');
            setShowTaskEndDatePicker(false);
        } catch (error) {
            console.error("Error adding task:", error);
        }
    };

    const removeTask = async (taskId) => {
        if (!userId) return;
        try {
            const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/data/tasks`, taskId);
            await deleteDoc(taskDocRef);
        } catch (error) {
            console.error("Error removing task:", error);
        }
    };

    const openEditModal = (task) => {
        setTaskToEdit(task);
        setEditModalOpen(true);
    };

    const saveEditedTask = async (editedTask) => {
        if (!userId || !editedTask.id) return;
        try {
            const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/data/tasks`, editedTask.id);
            await updateDoc(taskDocRef, {
                text: editedTask.text,
                date: editedTask.date,
                frequency: editedTask.frequency,
                endDate: editedTask.endDate,
            });
            setTaskToEdit(null);
            setEditModalOpen(false);
        } catch (error) {
            console.error("Error saving edited task:", error);
        }
    };

    // --- LLM Feature: Suggest Sub-tasks ---
    const handleSuggestSubtasks = async (taskText) => {
        if (!taskText.trim()) {
            setLlmError("Please enter a task to get suggestions.");
            setLlmResponseModalOpen(true);
            setLlmResponseTitle("Input Error");
            setLlmResponseContent("Please enter a task to get suggestions.");
            return;
        }

        setLlmLoading(true);
        setLlmError(null);
        setLlmResponseTitle("Suggested Sub-tasks");
        setLlmResponseContent("Generating suggestions...");
        setLlmResponseModalOpen(true);

        const prompt = `Break down the following task into a list of smaller, actionable sub-tasks. Provide only the list of sub-tasks as a JSON array of strings. Do not include any other text.
        Task: "${taskText}"`;

        const schema = {
            type: "ARRAY",
            items: { type: "STRING" }
        };

        try {
            const suggestions = await callGeminiApi(prompt, schema);
            setLlmResponseContent(suggestions);
        } catch (error) {
            setLlmError(error.message);
            setLlmResponseContent(`Error: ${error.message}`);
        } finally {
            setLlmLoading(false);
        }
    };

    const handleAddSuggestedTasks = async (suggestedTasks) => {
        if (!userId) {
            console.warn("Cannot add suggested tasks: User not authenticated.");
            return;
        }
        setLlmResponseModalOpen(false); // Close the suggestion modal

        const tasksRef = collection(db, `artifacts/${appId}/users/${userId}/data/tasks`);
        const currentDateTime = new Date().toISOString();

        for (const subtask of suggestedTasks) {
            try {
                await addDoc(tasksRef, {
                    text: subtask,
                    date: toAESTDateStr(new Date()), // Default to today's date
                    frequency: 'once',
                    endDate: '',
                    createdAt: currentDateTime,
                });
            } catch (error) {
                console.error("Error adding suggested subtask:", subtask, error);
            }
        }
    };

    // --- LLM Feature: Summarize Note ---
    const handleSummarizeNote = async (noteContent) => {
        if (!noteContent.trim()) {
            setLlmError("Note is empty. Nothing to summarize.");
            setLlmResponseModalOpen(true);
            setLlmResponseTitle("Input Error");
            setLlmResponseContent("Note is empty. Nothing to summarize.");
            return;
        }

        setLlmLoading(true);
        setLlmError(null);
        setLlmResponseTitle("Note Summary");
        setLlmResponseContent("Generating summary...");
        setLlmResponseModalOpen(true);

        const prompt = `Summarize the following note concisely:
        Note: "${noteContent}"`;

        try {
            const summary = await callGeminiApi(prompt);
            setLlmResponseContent(summary);
        } catch (error) {
            setLlmError(error.message);
            setLlmResponseContent(`Error: ${error.message}`);
        } finally {
            setLlmLoading(false);
        }
    };


    // --- File/Folder Management Functions (Firestore) ---
    const handleFileUpload = async (e) => {
        const uploadedFiles = Array.from(e.target.files);
        if (uploadedFiles.length === 0 || !userId) return;

        try {
            const filesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/data/files`);
            for (const file of uploadedFiles) {
                const fileExtension = file.name.split('.').pop();
                const finalFileName = fileTitle.trim() !== ''
                    ? `${fileTitle.trim()}.${fileExtension}`
                    : file.name;

                // For simplicity, we're not storing actual file data in Firestore.
                // In a real app, you'd upload the file to cloud storage (e.g., Firebase Storage)
                // and store the download URL here. For this demo, we'll use a placeholder URL.
                const placeholderSrc = URL.createObjectURL(file); // For local preview

                await addDoc(filesCollectionRef, {
                    name: finalFileName,
                    type: 'file',
                    src: placeholderSrc, // This URL is temporary and won't persist across sessions
                    date: fileDate,
                    parentId: currentFolder,
                    uploadedAt: new Date().toISOString(),
                });
            }
            setFileTitle('');
            e.target.value = null; // Clear file input
        } catch (error) {
            console.error("Error uploading file:", error);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !userId) return;

        try {
            const filesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/data/files`);
            await addDoc(filesCollectionRef, {
                name: newFolderName.trim(),
                type: 'folder',
                parentId: currentFolder,
                createdAt: new Date().toISOString(),
            });
            setNewFolderName('');
        } catch (error) {
            console.error("Error creating folder:", error);
        }
    };

    const removeFile = async (idToRemove) => {
        if (!userId) return;

        try {
            // Helper function to get all descendant IDs (including subfolders and files within them)
            const getAllDescendantIds = async (targetId, allItems) => {
                let ids = [targetId];
                const children = allItems.filter(item => item.parentId === targetId);
                for (const child of children) {
                    if (child.type === 'folder') {
                        ids = ids.concat(await getAllDescendantIds(child.id, allItems));
                    } else {
                        ids.push(child.id);
                    }
                }
                return ids;
            };

            const idsToDelete = await getAllDescendantIds(idToRemove, files);

            // Revoke object URLs for files being deleted (for local preview cleanup)
            idsToDelete.forEach(id => {
                const file = files.find(item => item.id === id && item.type === 'file');
                if (file && file.src && file.src.startsWith('blob:')) {
                    URL.revokeObjectURL(file.src);
                }
            });

            // Delete documents from Firestore
            for (const id of idsToDelete) {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/data/files`, id);
                await deleteDoc(docRef);
            }
        } catch (error) {
            console.error("Error removing file/folder:", error);
        }
    };

    // --- Calendar Logic (remains mostly the same, uses local 'tasks' state) ---
    const tasksByDate = tasks.reduce((acc, task) => {
        const startDate = new Date(task.date);
        const endDate = task.endDate ? new Date(task.endDate) : null;
        const taskWithId = { ...task }; // Use task.id from Firestore

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

    if (loadingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-2xl font-semibold text-gray-700">Loading authentication...</div>
            </div>
        );
    }

    if (!currentUser) {
        return <AuthScreen />;
    }

    return (
        <>
            {isLoading ? (
                <div className={`loading-screen ${isFadingOut ? 'fade-out' : ''} flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-200 to-purple-200 text-gray-800`}>
                    <h1 className="loading-text text-5xl font-extrabold text-center mb-8 animate-pulse">"What are you doing today?"</h1>
                    {showContinueButton && (
                        <button className="continue-button bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 transform hover:scale-110" onClick={handleContinue}>
                            Continue
                        </button>
                    )}
                </div>
            ) : (
                <div className="app-container min-h-screen bg-gray-100 flex flex-col lg:flex-row font-inter">
                    {/* Side Menu */}
                    <div className={`fixed inset-y-0 left-0 w-64 bg-gray-800 text-white p-6 transform ${menuOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-40 flex flex-col shadow-xl`}>
                        <button className="lg:hidden absolute top-4 right-4 text-white text-2xl" onClick={() => setMenuOpen(false)}>
                            &times;
                        </button>
                        <h2 className="text-3xl font-bold mb-8 text-center text-blue-300">Menu</h2>
                        <nav className="flex flex-col space-y-4 flex-grow">
                            <button
                                onClick={() => { setView('calendar'); setMenuOpen(false); }}
                                className="w-full text-left py-3 px-4 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-3 text-lg font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Calendar View</span>
                            </button>
                            <button
                                onClick={() => { setView('files'); setMenuOpen(false); }}
                                className="w-full text-left py-3 px-4 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-3 text-lg font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span>My Files</span>
                            </button>
                            <button
                                onClick={() => { setView('allTasks'); setMenuOpen(false); }}
                                className="w-full text-left py-3 px-4 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-3 text-lg font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                <span>My Task Gallery</span>
                            </button>
                            <button
                                onClick={() => { setView('notes'); setMenuOpen(false); }}
                                className="w-full text-left py-3 px-4 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center space-x-3 text-lg font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Notes</span>
                            </button>
                        </nav>
                        <div className="mt-auto pt-6 border-t border-gray-700">
                            <p className="text-sm text-gray-400 mb-2">Logged in as:</p>
                            <p className="text-sm font-semibold text-blue-200 break-all">{currentUser?.email || currentUser?.uid}</p>
                            <button
                                onClick={signOutUser}
                                className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 transform hover:scale-105 shadow-md"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-grow p-6 lg:ml-64 relative">
                        <button className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gray-800 text-white rounded-full shadow-lg" onClick={() => setMenuOpen(!menuOpen)}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        {view === 'calendar' && (
                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                                    The Organizer 📅 - {selectedDate.toLocaleString('default', { month: 'long' })} {year}
                                </h2>

                                <div className="add-task-form grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Task Name" className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                    <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                    <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                    <select value={frequency} onChange={(e) => {
                                        setFrequency(e.target.value);
                                        if (e.target.value === 'once') {
                                            setTaskEndDate('');
                                            setShowTaskEndDatePicker(false);
                                        } else {
                                            setShowTaskEndDatePicker(false);
                                        }
                                    }} className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400">
                                        <option value="once">Once</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>

                                    {isAddingRecurring && (
                                        <div className="col-span-full end-date-section mt-2 p-3 border border-gray-200 rounded-lg bg-gray-100">
                                            <label className="block text-gray-700 text-sm font-semibold mb-2">Ends:</label>
                                            {showTaskEndDatePicker ? (
                                                <div className="flex flex-col sm:flex-row gap-2 items-center">
                                                    <input
                                                        type="date"
                                                        value={taskEndDate}
                                                        onChange={(e) => setTaskEndDate(e.target.value)}
                                                        className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                    />
                                                    {taskEndDate && (
                                                        <button onClick={() => { setTaskEndDate(''); setShowTaskEndDatePicker(false); }} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200">Clear End Date</button>
                                                    )}
                                                </div>
                                            ) : (
                                                <button onClick={() => setShowTaskEndDatePicker(true)} className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200">Set End Date</button>
                                            )}
                                            {taskEndDate && <p className="mt-2 text-sm text-gray-600">Ends on: {new Date(taskEndDate).toLocaleDateString()}</p>}
                                        </div>
                                    )}
                                    <button onClick={addTask} className="col-span-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 shadow-md">Add Task</button>
                                    <button
                                        onClick={() => handleSuggestSubtasks(input)}
                                        className="col-span-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 shadow-md flex items-center justify-center gap-2"
                                        disabled={!input.trim()}
                                    >
                                        ✨ Suggest Sub-tasks
                                    </button>
                                </div>

                                <div className="nav-buttons flex flex-wrap justify-center gap-3 mb-6">
                                    <button onClick={() => setSelectedDate(new Date())} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200">Go to Today</button>
                                    <input type="date" value={gotoInput} onChange={(e) => setGotoInput(e.target.value)} className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                                    <button onClick={handleGoto} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200">Go to Date</button>
                                    <button onClick={() => changeMonth(-1)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200">Prev Month</button>
                                    <button onClick={() => changeMonth(1)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200">Next Month</button>
                                </div>

                                <div className="calendar-grid grid grid-cols-7 gap-1">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="text-center font-semibold text-gray-700 py-2 bg-gray-200 rounded-lg">
                                            {day}
                                        </div>
                                    ))}
                                    {calendarDays.map((day, index) => {
                                        if (!day) return <div key={index} className="calendar-cell empty bg-gray-50 rounded-lg"></div>;

                                        const formatted = toAESTDateStr(day);
                                        const tasksForDay = tasksByDate[formatted] || [];

                                        return (
                                            <div
                                                key={index}
                                                className={`calendar-cell p-2 border border-gray-200 rounded-lg relative overflow-hidden h-32 flex flex-col ${formatted === today ? 'bg-blue-100 border-blue-400' : 'bg-white'} ${formatted === toAESTDateStr(selectedDate) ? 'ring-2 ring-blue-500' : ''}`}
                                            >
                                                <strong className="text-lg font-bold text-gray-800 mb-1">{day.getDate()}</strong>

                                                <div className="tasks-list flex-grow overflow-y-auto custom-scrollbar">
                                                    {tasksForDay.length > 3 ? (
                                                        <details className="text-sm">
                                                            <summary className="cursor-pointer text-blue-600 font-semibold">{tasksForDay.length} tasks</summary>
                                                            {tasksForDay.map((task) => (
                                                                <div key={task.id} className="task-entry bg-blue-50 p-1 rounded-md mb-1 text-xs break-words">
                                                                    {task.text} {task.frequency && `(${task.frequency})`}
                                                                    {task.endDate && ` (Ends: ${new Date(task.endDate).toLocaleDateString()})`}
                                                                    <div className="flex gap-1 mt-1">
                                                                        <button onClick={() => openEditModal(task)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                                                                        <button onClick={() => removeTask(task.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </details>
                                                    ) : (
                                                        tasksForDay.map((task) => (
                                                            <div key={task.id} className="task-entry bg-blue-50 p-1 rounded-md mb-1 text-xs break-words">
                                                                {task.text} {task.frequency && `(${task.frequency})`}
                                                                {task.endDate && ` (Ends: ${new Date(task.endDate).toLocaleDateString()})`}
                                                                <div className="flex gap-1 mt-1">
                                                                    <button onClick={() => openEditModal(task)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                                                                    <button onClick={() => removeTask(task.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {view === 'files' && (
                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h2 className="text-3xl font-bold text-gray-800 mb-6">My Files</h2>

                                {currentFolder && (
                                    <button className="back-button mb-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2" onClick={() => setCurrentFolder(null)}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                        Back to Root
                                    </button>
                                )}

                                <div className="add-file-form grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <input
                                        type="text"
                                        placeholder="New Folder Name"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                                    />
                                    <button onClick={handleCreateFolder} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105 shadow-md">
                                        Create Folder
                                    </button>

                                    <input
                                        type="text"
                                        placeholder="File Title (optional)"
                                        value={fileTitle}
                                        onChange={(e) => setFileTitle(e.target.value)}
                                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                                    />
                                    <input
                                        type="date"
                                        value={fileDate}
                                        onChange={(e) => setFileDate(e.target.value)}
                                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                                    />
                                    <label className="col-span-full cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-center transition duration-300 transform hover:scale-105 shadow-md">
                                        Upload File
                                        <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                                    </label>
                                </div>

                                <div className="files-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {itemsInCurrentFolder.length === 0 && <p className="col-span-full text-center text-gray-500">No items in this folder. Add some!</p>}
                                    {itemsInCurrentFolder.map((item) => (
                                        <div key={item.id} className="file-item bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center text-center shadow-sm">
                                            {item.type === 'folder' ? (
                                                <button onClick={() => setCurrentFolder(item.id)} className="w-full h-24 flex flex-col items-center justify-center text-blue-600 hover:text-blue-800 transition duration-200">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                    </svg>
                                                    <span className="text-sm font-semibold truncate w-full">{item.name}</span>
                                                </button>
                                            ) : (
                                                <a href={item.src} target="_blank" rel="noopener noreferrer" className="w-full h-24 flex flex-col items-center justify-center text-gray-700 hover:text-blue-600 transition duration-200">
                                                    {item.src && (item.name.toLowerCase().endsWith('.png') || item.name.toLowerCase().endsWith('.jpg') || item.name.toLowerCase().endsWith('.jpeg') || item.name.toLowerCase().endsWith('.gif')) ? (
                                                        <img src={item.src} alt={item.name} className="max-h-16 max-w-full object-contain mb-2 rounded-md" />
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                        </svg>
                                                    )}
                                                    <span className="text-sm font-semibold truncate w-full">{item.name}</span>
                                                </a>
                                            )}
                                            <span className="text-xs text-gray-500 mt-1">{item.date}</span>
                                            <button onClick={() => removeFile(item.id)} className="mt-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded-md transition duration-200">
                                                Delete
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {view === 'allTasks' && (
                            <div className="bg-white p-6 rounded-xl shadow-lg">
                                <h2 className="text-3xl font-bold text-gray-800 mb-6">My Task Gallery</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {tasks.length === 0 && <p className="col-span-full text-center text-gray-500">No tasks yet. Add some in Calendar View!</p>}
                                    {tasks.map((task) => (
                                        <div key={task.id} className="task-card bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col">
                                            <p className="text-lg font-semibold text-gray-800 mb-2">{task.text}</p>
                                            <p className="text-sm text-gray-600">Date: {toAESTDateStr(task.date)} {task.date.includes('T') && new Date(task.date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                            <p className="text-sm text-gray-600">Frequency: {task.frequency}</p>
                                            {task.endDate && <p className="text-sm text-gray-600">Ends: {toAESTDateStr(task.endDate)}</p>}
                                            <div className="flex gap-2 mt-4">
                                                <button onClick={() => openEditModal(task)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200">Edit</button>
                                                <button onClick={() => removeTask(task.id)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200">Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {view === 'notes' && (
                            <Notes notes={notes} setNotes={setNotes} userId={userId} onSummarizeNote={handleSummarizeNote} />
                        )}
                    </div>
                </div>
            )}
            <EditTaskModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} task={taskToEdit} onSave={saveEditedTask} onSuggestSubtasks={handleSuggestSubtasks} />

            <LLMResponseModal
                isOpen={llmResponseModalOpen}
                onClose={() => setLlmResponseModalOpen(false)}
                title={llmResponseTitle}
                content={llmLoading ? "Loading..." : (llmError || llmResponseContent)}
                onAddAsTasks={llmResponseTitle === "Suggested Sub-tasks" ? handleAddSuggestedTasks : null}
            />
        </>
    );
}

// Root component for the entire application
function App() {
    return (
        <AuthProvider>
            <TodoApp />
        </AuthProvider>
    );
}

export default App;
