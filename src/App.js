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

import './App.css'; // Don't forget to import your CSS!

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
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>{title}</h3>
                <div className="llm-response-content">
                    {Array.isArray(content) ? (
                        <ul className="llm-list">
                            {content.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="llm-text">{content}</p>
                    )}
                </div>
                <div className="modal-buttons">
                    {onAddAsTasks && Array.isArray(content) && content.length > 0 && (
                        <button
                            onClick={() => onAddAsTasks(content)}
                            className="llm-add-tasks-button"
                        >
                            Add All as New Tasks
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="llm-close-button"
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
        <div className="auth-container">
            <div className="auth-card">
                <h2>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="your@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {authError && <p className="auth-error">{authError}</p>}
                    {message && <p className="auth-message">{message}</p>}
                    <button type="submit" className="auth-submit-button">
                        {isLogin ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>
                <div className="auth-switch">
                    <button onClick={() => setIsLogin(!isLogin)} className="auth-switch-button">
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
                >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>

                {isRecurring && (
                    <div className="end-date-section">
                        <label>Ends:</label>
                        {showEndDatePicker ? (
                            <>
                                <input
                                    type="date"
                                    value={editEndDate}
                                    onChange={(e) => setEditEndDate(e.target.value)}
                                />
                                {editEndDate && (
                                    <button
                                        onClick={() => {
                                            setEditEndDate('');
                                            setShowEndDatePicker(false);
                                        }}
                                    >
                                        Clear End Date
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={() => setShowEndDatePicker(true)}>Set End Date</button>
                        )}
                        {editEndDate && <p>Ends on: {new Date(editEndDate).toLocaleDateString()}</p>}
                    </div>
                )}

                <div className="modal-buttons">
                    <button
                        onClick={() => onSuggestSubtasks(editText)}
                        disabled={!editText.trim()}
                        className="suggest-subtasks-button"
                    >
                        ✨ Suggest Sub-tasks
                    </button>
                    <button onClick={handleSave}>Save</button>
                    <button onClick={onClose}>Cancel</button>
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
        <div className="notes-container">
            <h2>My Notes</h2>
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
                {notesArray.length === 0 && <p className="no-notes-message">No notes yet. Add one above!</p>}
                {notesArray.map((note) => (
                    <div key={note.id} className="note-card">
                        <div className="note-header">
                            <button
                                className="note-title-button"
                                onClick={() => toggleNote(note.id)}
                            >
                                Note {notesArray.indexOf(note) + 1}
                            </button>
                            <div className="note-actions">
                                <button
                                    onClick={() => onSummarizeNote(note.content)}
                                    disabled={!note.content.trim()}
                                    className="summarize-note-button"
                                >
                                    ✨ Summarize
                                </button>
                                <button
                                    className="delete-note-button"
                                    onClick={() => deleteNote(note.id)}>
                                    Delete
                                </button>
                            </div>
                        </div>
                        {openNoteIds.includes(note.id) && (
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

// --- Main TodoApp Component ---
function TodoApp() { // Removed 'export default'
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
            <div className="loading-screen">
                <div className="loading-text">Loading authentication...</div>
            </div>
        );
    }

    if (!currentUser) {
        return <AuthScreen />;
    }

    return (
        <>
            {isLoading ? (
                <div className={`loading-screen ${isFadingOut ? 'fade-out' : ''}`}>
                    <h1 className="loading-text">"What are you doing today?"</h1>
                    {showContinueButton && (
                        <button className="continue-button" onClick={handleContinue}>
                            Continue
                        </button>
                    )}
                </div>
            ) : (
                <div className="app-container">
                    {/* Side Menu */}
                    <div className={`side-menu ${menuOpen ? 'open' : ''}`}>
                        <button className="menu-toggle" onClick={() => setMenuOpen(false)}>
                            &times;
                        </button>
                        <h2>Menu</h2>
                        <nav className="side-menu-nav">
                            <button onClick={() => { setView('calendar'); setMenuOpen(false); }}>
                                Calendar View
                            </button>
                            <button onClick={() => { setView('files'); setMenuOpen(false); }}>
                                My Files
                            </button>
                            <button onClick={() => { setView('allTasks'); setMenuOpen(false); }}>
                                My Task Gallery
                            </button>
                            <button onClick={() => { setView('notes'); setMenuOpen(false); }}>
                                Notes
                            </button>
                        </nav>
                        <div className="user-info">
                            <p>Logged in as:</p>
                            <p className="user-id">{currentUser?.email || currentUser?.uid}</p>
                            <button onClick={signOutUser} className="sign-out-button">
                                Sign Out
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="main-view">
                        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                            ☰
                        </button>

                        {view === 'calendar' && (
                            <>
                                <h2>
                                    The Organizer 📅 - {selectedDate.toLocaleString('default', { month: 'long' })} {year}
                                </h2>

                                <div className="add-task-form">
                                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Task Name" />
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
                                                        <button onClick={() => { setTaskEndDate(''); setShowTaskEndDatePicker(false); }}>Clear End Date</button>
                                                    )}
                                                </>
                                            ) : (
                                                <button onClick={() => setShowTaskEndDatePicker(true)}>Set End Date</button>
                                            )}
                                            {taskEndDate && <p>Ends on: {new Date(taskEndDate).toLocaleDateString()}</p>}
                                        </div>
                                    )}
                                    <button onClick={addTask}>Add Task</button>
                                    <button
                                        onClick={() => handleSuggestSubtasks(input)}
                                        disabled={!input.trim()}
                                        className="suggest-subtasks-button"
                                    >
                                        ✨ Suggest Sub-tasks
                                    </button>
                                </div>

                                <div className="nav-buttons">
                                    <button onClick={() => setSelectedDate(new Date())}>Go to Today</button>
                                    <input type="date" value={gotoInput} onChange={(e) => setGotoInput(e.target.value)} />
                                    <button onClick={handleGoto}>Go to Date</button>
                                    <button onClick={() => changeMonth(-1)}>Prev Month</button>
                                    <button onClick={() => changeMonth(1)}>Next Month</button>
                                </div>

                                <div className="calendar-grid">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                        <div key={day} className="calendar-header-day">
                                            {day}
                                        </div>
                                    ))}
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

                                                <div className="tasks-list custom-scrollbar">
                                                    {tasksForDay.length > 3 ? (
                                                        <details className="task-details">
                                                            <summary className="task-summary">{tasksForDay.length} tasks</summary>
                                                            {tasksForDay.map((task) => (
                                                                <div key={task.id} className="task-entry">
                                                                    {task.text} {task.frequency && `(${task.frequency})`}
                                                                    {task.endDate && ` (Ends: ${new Date(task.endDate).toLocaleDateString()})`}
                                                                    <div className="task-actions">
                                                                        <button onClick={() => openEditModal(task)}>Edit</button>
                                                                        <button onClick={() => removeTask(task.id)}>Delete</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </details>
                                                    ) : (
                                                        tasksForDay.map((task) => (
                                                            <div key={task.id} className="task-entry">
                                                                {task.text} {task.frequency && `(${task.frequency})`}
                                                                {task.endDate && ` (Ends: ${new Date(task.endDate).toLocaleDateString()})`}
                                                                <div className="task-actions">
                                                                    <button onClick={() => openEditModal(task)}>Edit</button>
                                                                    <button onClick={() => removeTask(task.id)}>Delete</button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {view === 'files' && (
                            <div>
                                <h2>My Files</h2>

                                {currentFolder && (
                                    <button className="back-button" onClick={() => setCurrentFolder(null)}>← Back to Root</button>
                                )}

                                <div className="add-file-form">
                                    <input
                                        type="text"
                                        placeholder="New Folder Name"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                    />
                                    <button onClick={handleCreateFolder}>Create Folder</button>

                                    <input
                                        type="text"
                                        placeholder="File Title (optional)"
                                        value={fileTitle}
                                        onChange={(e) => setFileTitle(e.target.value)}
                                    />
                                    <input
                                        type="date"
                                        value={fileDate}
                                        onChange={(e) => setFileDate(e.target.value)}
                                    />
                                    <label className="upload-file-button">
                                        Upload File
                                        <input type="file" multiple onChange={handleFileUpload} className="hidden-input" />
                                    </label>
                                </div>

                                <div className="file-gallery">
                                    {itemsInCurrentFolder.length === 0 && <p className="no-items-message">No items in this folder. Add some!</p>}
                                    {itemsInCurrentFolder.map((item) => (
                                        <div key={item.id} className="file-item">
                                            {item.type === 'folder' ? (
                                                <button onClick={() => setCurrentFolder(item.id)} className="folder-item">
                                                    <span className="folder-icon">📁</span>
                                                    <span className="file-name">{item.name}</span>
                                                </button>
                                            ) : (
                                                <a href={item.src} target="_blank" rel="noopener noreferrer" className="file-link">
                                                    {item.src && (item.name.toLowerCase().endsWith('.png') || item.name.toLowerCase().endsWith('.jpg') || item.name.toLowerCase().endsWith('.jpeg') || item.name.toLowerCase().endsWith('.gif')) ? (
                                                        <img src={item.src} alt={item.name} className="file-image" />
                                                    ) : (
                                                        <span className="file-icon">📄</span>
                                                    )}
                                                    <span className="file-name">{item.name}</span>
                                                </a>
                                            )}
                                            <div className="file-info">
                                                <span>{item.date}</span>
                                                <button onClick={() => removeFile(item.id)}>Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {view === 'allTasks' && (
                            <div>
                                <h2>My Task Gallery</h2>
                                <div className="task-gallery">
                                    {tasks.length === 0 && <p className="no-tasks-message">No tasks yet. Add some in Calendar View!</p>}
                                    {tasks.map((task) => (
                                        <div key={task.id} className="task-entry-gallery">
                                            <p className="task-text">{task.text}</p>
                                            <p className="task-details-gallery">Date: {toAESTDateStr(task.date)} {task.date.includes('T') && new Date(task.date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                            <p className="task-details-gallery">Frequency: {task.frequency}</p>
                                            {task.endDate && <p className="task-details-gallery">Ends: {toAESTDateStr(task.endDate)}</p>}
                                            <div className="task-actions-gallery">
                                                <button onClick={() => openEditModal(task)}>Edit</button>
                                                <button onClick={() => removeTask(task.id)}>Delete</button>
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
