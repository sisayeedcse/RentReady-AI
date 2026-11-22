-- RentReady AI — Local Development Seed Data (TEST DATA ONLY)
-- Per AppQuest 2.0 Booklet p. 17: Use test data only during build phase.
-- Run manually against local Supabase only; never run against production.

-- Seed helper note:
-- After registering a test landlord in Supabase Auth, you can use the RentReady AI UI
-- or API "Load Demo Data" button (dev mode) to populate:
--   Property: "Shanti Nibash" (Dhanmondi 9/A, Dhaka)
--   Units: 2A (15,000 BDT), 3B (12,000 BDT), 4A (14,000 BDT - Vacant)
--   Tenants:
--     - Rahim Uddin (+8801900000001 - Test Banglalink) -> Unit 3B
--     - Karim Hossain (+8801900000002 - Test Banglalink) -> Unit 2A
--   Obligations: Current month generated automatically
--   Sample partial payment: 8,000 BDT via bKash for Unit 3B (4,000 BDT remaining)
SELECT 'RentReady AI seed reference ready (test data only)' AS status;
