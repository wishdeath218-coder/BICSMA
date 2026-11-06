# Sequence Diagram — Trigger SOS

The SOS button currently opens a confirmation prompt and, when confirmed, asks the device to open its phone dialer for 911. It does not send an SOS event, location, or notification to the app backend.

```mermaid
sequenceDiagram
  autonumber
  actor Resident
  participant Screen as Emergency Hotlines Screen
  participant Confirm as Confirmation Dialog
  participant OS as Mobile OS / Browser
  participant Dialer as Phone Dialer
  participant Emergency as 911 Emergency Service

  Resident->>Screen: Tap SOS / Call 911
  Screen->>Confirm: Show "Call 911 — National Emergency?"
  Confirm-->>Resident: Explain that the phone dialer will open

  alt Resident cancels
    Resident->>Confirm: Cancel
    Confirm-->>Screen: No action
    Screen-->>Resident: Stay on Emergency Hotlines screen
  else Resident confirms
    Resident->>Confirm: Confirm CALL 911
    Confirm->>Screen: Invoke confirmed callback
    Screen->>OS: Linking.openURL("tel:911")
    OS->>Dialer: Open phone dialer with 911
    Dialer-->>Resident: Display or start call according to device behavior
    Resident->>Dialer: Place or confirm the call if prompted
    Dialer->>Emergency: Place call to 911
    Emergency-->>Resident: Handle emergency call
  end
```

**Important:** This flow depends on the device and platform supporting the `tel:` URL. The app does not verify that the call connected, and tapping SOS does not contact the barangay, share GPS location, or create a database record.
