import React, { useState, useEffect, useMemo } from 'react';
import { getFirestore, collection, getDocs, Timestamp, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import app from '../firebaseConfig';
import { AnimatePresence, motion } from 'framer-motion';

// Interfaces for data types
interface Client {
    id: string;
    name: string;
    phone: string;
}

interface Booking {
    id: string;
    clientId: string;
    callType: 'onboarding' | 'follow-up';
    startTime: Timestamp;
    durationMinutes: number;
}

const Calendar = () => {
    // State hooks
    const [clients, setClients] = useState<Client[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const [isFormVisible, setIsFormVisible] = useState(false);
    const [selectedSlotTime, setSelectedSlotTime] = useState<Date | null>(null);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [selectedCallType, setSelectedCallType] = useState<'onboarding' | 'follow-up'>('onboarding');

    // Day names and month names for calendar display
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Function to generate time slots (moved inside component for clarity)
    const generateTimeSlots = (date: Date) => {
        const slots = [];
        const startTime = new Date(date);
        startTime.setHours(10, 30, 0, 0);

        const endTime = new Date(date);
        endTime.setHours(19, 30, 0, 0);

        let currentTime = startTime;

        while (currentTime <= endTime) {
            const slotTime = new Date(currentTime);
            slots.push(slotTime);
            currentTime.setMinutes(currentTime.getMinutes() + 20);
        }
        return slots;
    };

    // Generate month days for the calendar grid
    const getDaysInMonth = (month: Date) => {
        const startDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        const prevMonthDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();

        const calendarDays = [];

        // Fill in previous month's trailing days
        for (let i = startDay - 1; i >= 0; i--) {
            calendarDays.push(new Date(month.getFullYear(), month.getMonth() - 1, prevMonthDays - i));
        }

        // Fill in current month's days
        for (let i = 1; i <= daysInMonth; i++) {
            calendarDays.push(new Date(month.getFullYear(), month.getMonth(), i));
        }

        // Fill in next month's leading days
        while (calendarDays.length % 7 !== 0) {
            calendarDays.push(new Date(month.getFullYear(), month.getMonth() + 1, calendarDays.length - (startDay + daysInMonth) + 1));
        }

        return calendarDays;
    };

    const calendarDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

    // Effect hook to fetch data from Firestore
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const db = getFirestore(app);

                // Fetch clients
                const clientsCollectionRef = collection(db, 'clients');
                const clientsSnapshot = await getDocs(clientsCollectionRef);
                const clientsList = clientsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name as string,
                    phone: doc.data().phone as string,
                }));
                setClients(clientsList);

                // Fetch bookings for the current month
                const startOfMonth = Timestamp.fromDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 0, 0, 0));
                const endOfMonth = Timestamp.fromDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59));

                const bookingsQuery = query(collection(db, 'bookings'),
                    where('startTime', '>=', startOfMonth),
                    where('startTime', '<=', endOfMonth)
                );
                const bookingsSnapshot = await getDocs(bookingsQuery);
                const bookingsList = bookingsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    startTime: doc.data().startTime as Timestamp
                })) as Booking[];

                setBookings(bookingsList);

            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentMonth]);

    // Check if a specific date has any bookings
    const hasBookingsOnDate = (date: Date) => {
        return bookings.some(booking => booking.startTime.toDate().toDateString() === date.toDateString());
    };

    // Filter bookings for a specific date
    const getBookingsOnDate = (date: Date) => {
        return bookings.filter(booking => booking.startTime.toDate().toDateString() === date.toDateString());
    };

    // Handler for date click
    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
    };

    // Handler for showing the booking form
    const handleShowBookingForm = () => {
        if (selectedDate) {
            setIsFormVisible(true);
        }
    };

    // Handler for form submission
    const handleBookingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlotTime || !selectedClient) return;

        const db = getFirestore(app);

        // Initial booking object for overlap check
        const newBooking = {
            clientId: selectedClient,
            callType: selectedCallType,
            startTime: Timestamp.fromDate(selectedSlotTime),
            durationMinutes: selectedCallType === 'onboarding' ? 40 : 20,
        };

        // Check for overlap on the selected day
        const existingBookingsForDay = getBookingsOnDate(selectedSlotTime);
        const isOverlap = existingBookingsForDay.some(existingBooking => {
            const existingStart = existingBooking.startTime.toDate().getTime();
            const existingEnd = existingStart + existingBooking.durationMinutes * 60000;
            const newStart = selectedSlotTime.getTime();
            const newEnd = newStart + newBooking.durationMinutes * 60000;

            return (
                (newStart >= existingStart && newStart < existingEnd) ||
                (newEnd > existingStart && newEnd <= existingEnd) ||
                (newStart <= existingStart && newEnd >= existingEnd)
            );
        });

        if (isOverlap) {
            alert("This time slot overlaps with an existing booking. Please choose another time.");
            return;
        }

        const bookingsCollectionRef = collection(db, 'bookings');

        if (selectedCallType === 'follow-up') {
            const bookingsToCreate = [];
            const oneYearFromNow = new Date(selectedSlotTime);
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

            let currentBookingDate = new Date(selectedSlotTime);

            while (currentBookingDate < oneYearFromNow) {
                bookingsToCreate.push({
                    clientId: selectedClient,
                    callType: 'follow-up',
                    startTime: Timestamp.fromDate(currentBookingDate),
                    durationMinutes: 20,
                });
                // Move to the next week (7 days later)
                currentBookingDate.setDate(currentBookingDate.getDate() + 7);
            }

            const promises = bookingsToCreate.map(booking => addDoc(bookingsCollectionRef, booking));
            await Promise.all(promises);

            alert(`Successfully booked a year of weekly follow-up calls for the client.`);

        } else {
            // Original logic for a single onboarding call
            await addDoc(bookingsCollectionRef, newBooking);
            alert(`Successfully booked an onboarding call.`);
        }

        // Reset state and refresh
        setSelectedSlotTime(null);
        setSelectedClient('');
        setIsFormVisible(false);
        setCurrentMonth(new Date(currentMonth));
    };

    // Modal time slots
    const modalTimeSlots = useMemo(() => {
        if (!selectedDate) return [];
        return generateTimeSlots(selectedDate);
    }, [selectedDate]);

    // Handler for deleting a booking
    const handleDeleteBooking = async (bookingId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        try {
            const db = getFirestore(app);
            await deleteDoc(doc(db, 'bookings', bookingId));
            setCurrentMonth(new Date(currentMonth));
        } catch (error) {
            console.error("Error deleting booking: ", error);
            alert("Failed to delete booking.");
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen p-8 bg-gray-100 font-sans">
            <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-8">
                {/* Calendar Header */}
                <h1 className="text-3xl font-cursive text-gray-800 text-center mb-6">Coach's Calendar</h1>
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                        className="p-2 bg-white rounded-full shadow hover:bg-gray-200 transition-colors"
                        aria-label="Previous month"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </button>
                    <h2 className="text-xl font-semibold text-gray-700">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                        className="p-2 bg-white rounded-full shadow hover:bg-gray-200 transition-colors"
                        aria-label="Next month"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                    </button>
                </div>
                
                {/* Day of the week header */}
                <div className="grid grid-cols-7 text-center font-medium text-gray-500 text-sm">
                    {days.map(day => (
                        <div key={day} className="py-2">{day}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-px border border-gray-200 rounded-md overflow-hidden">
                    {loading ? (
                        <div className="col-span-7 p-8 text-center text-gray-500">Loading calendar...</div>
                    ) : (
                        calendarDays.map((day, index) => {
                            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                            const hasBooking = hasBookingsOnDate(day);
                            const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
                            
                            let dayClass = 'h-24 p-2 text-center transition-colors border-r border-b border-gray-200 last:border-r-0';
                            dayClass += isCurrentMonth ? ' bg-white text-gray-900' : ' bg-gray-50 text-gray-400';
                            dayClass += isSelected ? ' bg-blue-100 ring-2 ring-blue-500' : ' hover:bg-gray-100 cursor-pointer';

                            return (
                                <div
                                    key={index}
                                    className={dayClass}
                                    onClick={() => handleDateClick(day)}
                                >
                                    <span className={`font-semibold text-sm ${hasBooking ? 'text-red-600' : ''}`}>
                                        {day.getDate()}
                                    </span>
                                    {hasBooking && (
                                        <ul className="mt-1 space-y-1">
                                            {getBookingsOnDate(day).map(booking => {
                                                const clientName = clients.find(c => c.id === booking.clientId)?.name;
                                                return (
                                                    <li key={booking.id} className="text-xs text-red-600 truncate">
                                                        <span className="font-medium">{booking.callType}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Selected Date Info Section */}
                <div className="mt-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Bookings for {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Select a date'}</h2>
                    {selectedDate && (
                        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md">
                            <thead>
                                <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
                                    <th className="px-6 py-3 text-left">Client</th>
                                    <th className="px-6 py-3 text-left">Call Type</th>
                                    <th className="px-6 py-3 text-left">Time</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getBookingsOnDate(selectedDate).map(booking => {
                                    const client = clients.find(c => c.id === booking.clientId);
                                    const startTime = booking.startTime.toDate();
                                    return (
                                        <tr key={booking.id} className="border-b hover:bg-gray-50">
                                            <td className="px-6 py-4">{client ? client.name : 'Unknown Client'}</td>
                                            <td className="px-6 py-4 capitalize">{booking.callType}</td>
                                            <td className="px-6 py-4">{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(e) => handleDeleteBooking(booking.id, e)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {!selectedDate && (
                        <p className="text-gray-500">Please select a date to view bookings.</p>
                    )}
                </div>

                {/* Booking Button Section */}
                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleShowBookingForm}
                        className={`px-6 py-3 text-sm font-semibold text-white rounded-lg transition-colors
                            ${selectedDate ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                        disabled={!selectedDate}
                    >
                        Create Booking
                    </button>
                </div>
            </div>
            
            {/* Form Modal */}
            <AnimatePresence>
                {isFormVisible && (
                    <motion.div
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20"
                        onClick={() => { setIsFormVisible(false); setSelectedDate(null); }}
                    >
                        <motion.div
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white text-black p-8 rounded-2xl w-[90%] max-w-md shadow-lg"
                        >
                            {isFormVisible && selectedDate && (
                                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform scale-100 animate-fade-in-up">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-2xl font-bold text-gray-800">New Booking</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-6">
                                        for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                    <form onSubmit={handleBookingSubmit} className="space-y-4">
                                        <div>
                                            <label htmlFor="client-select" className="block text-sm font-medium text-gray-700">Select Client</label>
                                            <select
                                                id="client-select"
                                                value={selectedClient}
                                                onChange={(e) => setSelectedClient(e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                                required
                                            >
                                                <option value="" disabled>-- Select a Client --</option>
                                                {clients.map(client => (
                                                    <option key={client.id} value={client.id}>{client.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="call-type" className="block text-sm font-medium text-gray-700">Call Type</label>
                                            <select
                                                id="call-type"
                                                value={selectedCallType}
                                                onChange={(e) => setSelectedCallType(e.target.value as 'onboarding' | 'follow-up')}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                            >
                                                <option value="onboarding">Onboarding (40 min)</option>
                                                <option value="follow-up">Follow-up (20 min)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="time-slot" className="block text-sm font-medium text-gray-700">Select Time</label>
                                            <select
                                                id="time-slot"
                                                value={selectedSlotTime ? selectedSlotTime.toISOString() : ''}
                                                onChange={(e) => setSelectedSlotTime(new Date(e.target.value))}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                                                required
                                            >
                                                <option value="" disabled>-- Select a Time --</option>
                                                {modalTimeSlots.map((slot, index) => {
                                                    const isBooked = getBookingsOnDate(selectedDate).some(booking => booking.startTime.toDate().getTime() === slot.getTime());
                                                    return (
                                                        <option key={index} value={slot.toISOString()} disabled={isBooked}>
                                                            {slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {isBooked && '(Booked)'}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        
                                        <div className="flex justify-end space-x-2 pt-4">
                                            <button
                                                type="button"
                                                onClick={() => { setIsFormVisible(false); setSelectedDate(null); }}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                                Book Call
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Calendar;