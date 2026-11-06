-- First create an account through the app so its password is securely hashed.
-- Then replace the username below and run this once to approve/promote it.
update public.accounts
set name = 'Barangay Admin',
    role = 'admin',
    barangay_position = 'Barangay Secretary',
    status = 'Approved',
    rejection_reason = null
where username = 'MarvieDalilima'
returning username, role, status;
