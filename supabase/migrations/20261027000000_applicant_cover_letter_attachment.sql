-- Applicants may update only the cover-letter path column.
GRANT UPDATE (cover_letter_path)
ON public.applications
TO authenticated;

CREATE POLICY "Job seekers can attach their own cover letter"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  applicant_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'job_seeker'
  )
)
WITH CHECK (
  applicant_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'job_seeker'
  )
);

-- UPDATE policies are combined. The existing status-column grant means
-- an applicant UPDATE policy also needs a trigger guarding status.
CREATE FUNCTION public.guard_application_cover_letter_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.applicant_id = auth.uid()
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.applicant_id IS DISTINCT FROM OLD.applicant_id
       OR NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.resume_id IS DISTINCT FROM OLD.resume_id
     )
  THEN
    RAISE EXCEPTION 'Applicants may only attach a cover letter.';
  END IF;

  IF NEW.cover_letter_path IS DISTINCT FROM OLD.cover_letter_path THEN
    IF auth.uid() IS DISTINCT FROM OLD.applicant_id
       OR NEW.cover_letter_path IS NULL
       OR NEW.cover_letter_path NOT LIKE
          OLD.applicant_id::text || '/' || OLD.id::text || '/%.pdf'
       OR split_part(NEW.cover_letter_path, '/', 4) <> ''
       OR NOT EXISTS (
         SELECT 1
         FROM storage.objects o
         WHERE o.bucket_id = 'cover_letters'
           AND o.name = NEW.cover_letter_path
       )
    THEN
      RAISE EXCEPTION 'Invalid cover letter attachment.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_application_cover_letter_update_trigger
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.guard_application_cover_letter_update();