# Coach's Calendar

A modern, minimalist calendar application for managing client calls. This application allows a coach to view their schedule, book new one-time or recurring calls, and manage existing appointments. The user interface is designed for clarity and ease of use, with a clean layout and an intuitive booking flow.

---

## How to Use It

### 1. **Navigating the Calendar**

* The main view shows a **monthly calendar**.
* Use the **Prev** and **Next** buttons to navigate through months.
* View your schedule for any desired time period.

### 2. **Selecting a Date**

* Click on any date in the calendar grid to select it.
* The selected date will be visually highlighted.
* The **"Bookings for..."** section updates to show appointments for that day.

### 3. **Creating a New Booking**

#### Step-by-Step:

1. **Select a date** on the calendar.
2. Click the **"Create Booking"** button (bottom right).
3. A centered **modal** appears with a clean booking form.

#### Inside the Modal:

* **Select Client**: Choose from the dropdown.
* **Choose Call Type**:

  * **Onboarding (40 min)**: A one-time call on the selected date.
  * **Follow-up (20 min, weekly)**: Automatically creates **weekly bookings** for **1 year**, starting from the selected date.
* **Select Time**: Choose an available time slot. Booked times are **grayed out**.
* Click **"Book Call"** to save. The calendar auto-refreshes.

### 4. **Viewing & Managing Existing Bookings**

* **Marked dates** indicate existing bookings.
* Select a date to view all bookings in the **detailed list** below.
* Use the **Delete** button to permanently remove a booking.

---

## Conflict Handling

* The system **prevents overlapping bookings**.
* If a time slot is already taken, you will see an **alert**, and booking will be blocked.

---

## Firebase Schema Description

The app uses **two main Firestore collections**:

| Collection | Purpose                    | Fields                                                                                                                                                              |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clients`  | Stores client info         | - `id`: string (auto-generated)<br>- `name`: string<br>- `phone`: string                                                                                            |
| `bookings` | Stores all booking entries | - `id`: string (auto-generated)<br>- `clientId`: string<br>- `callType`: `'onboarding'` or `'follow-up'`<br>- `date`: timestamp<br>- `time`: string (e.g., '14:30') |

---

## Assumptions Made

* **Unified Bookings Collection**: Both onboarding and follow-up bookings are stored in a single `bookings` collection. Follow-up calls generate 52 weekly entries upfront.
* **Pre-populated Clients**: The `clients` collection is assumed to be **pre-filled** for booking purposes.
* **Timezone**: All time-based operations are based on the **user's local browser time**. No universal UTC-based system is currently used.
* **Minimal UI**: Design follows a **centered layout** with modals for bookings, based on a minimalist template.
* **Entry Point**: `src/main.tsx`, `src/App.tsx`

---
## Summary

Coach's Calendar is a streamlined coaching schedule manager with recurring booking automation, real-time conflict detection, and an intuitive UI designed for productivity. It is ideal for coaches who manage multiple client calls each week and need a reliable, elegant booking solution.
