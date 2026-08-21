DROP FUNCTION IF EXISTS public.wipe_all_application_data() CASCADE;

DROP POLICY IF EXISTS "Admins can delete feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can delete debt payments" ON public.debt_payments;