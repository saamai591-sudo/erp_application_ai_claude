
-------------------------------------
CREATE   PROC ATN.spSendAttendanceCalculationToPayrol

(@CalendarMonthID INT, @SelectedPersonel NVARCHAR(MAX))
    
    AS
    
    --	@Type = 1		ForCalculation
    --	@Type = 2			ForDelete
    --	@Type = 3			ForSendingToPayroll
    --	@Type = 4		ForReturnFromPayroll
    BEGIN TRY   
    
DECLARE @ErrorMessage NVARCHAR(MAX)
	DECLARE @ErrorSeverity INT
					, @ErrorState INT;    
    
    
SELECT VALUE PersonelID
INTO   #Personel
FROM   CFG.R_FnCommaStr2Table(@SelectedPersonel)
   
   BEGIN TRY  
		Exec ATN.spAttendaceCalculationControls @CalendarMonthID,@SelectedPersonel,3

	END TRY  
	BEGIN CATCH  
		

			SELECT 
				@ErrorMessage = ERROR_MESSAGE(),
				@ErrorSeverity = ERROR_SEVERITY(),
				@ErrorState = ERROR_STATE();

	
			RAISERROR (@ErrorMessage, -- Message text.
							@ErrorSeverity, -- Severity.
							@ErrorState -- State.
							);
			RETURN;
	END CATCH  
    
   
 
       
       ------- check if at least one person has been calculated in payroll
       -- For all operations this Control will be executed   
       
       
INSERT INTO pay.ParameterMonthlyData
       (
           -- ParameterMonthlyDataID -- this column value is auto-generated
           ParameterID,
           PersonnelID,
           CalendarMonthID,
           IssueCalendarMonthID,
           [Value],
           Version,
           Creator,
           CreationDate,
           LastEditor,
           LastEditionDate,
           PaymentSubjectID,
           PettyCashCostItemID,
           DebitCreditNoteItemID
       )
SELECT ppcr.ParameterID,
       acp1.PersonelID,
       @CalendarMonthID,
       @CalendarMonthID,
       ppcr.[Value],
       0,
       -1,
       GETDATE(),
       -1,
       GETDATE(),
       NULL,
       NULL,
       NULL
FROM   atn.AttendanceCalculationPersonnel AS acp1
       JOIN atn.PayParameterCalculationResult AS ppcr
            ON  ppcr.AttendanceCalculationPersonnelID = acp1.AttendanceCalculationPersonnelID
            JOIN #Personel p ON acp1.PersonelID = p.PersonelID
WHERE  acp1.CalendarMonthID = @CalendarMonthID
and ppcr.ParameterID is NOT null
     
     
     
       
       
UPDATE acp1
SET    acp1.[Status] = 2
FROM   atn.AttendanceCalculationPersonnel AS acp1
       JOIN #Personel p
            ON  acp1.PersonelID = p.PersonelID
WHERE  acp1.CalendarMonthID = @CalendarMonthID


	END TRY  
	BEGIN CATCH  
			

			SELECT 
				@ErrorMessage = ERROR_MESSAGE(),
				@ErrorSeverity = ERROR_SEVERITY(),
				@ErrorState = ERROR_STATE();

	
			RAISERROR (@ErrorMessage, -- Message text.
							@ErrorSeverity, -- Severity.
							@ErrorState -- State.
							);
			RETURN;
	END CATCH  
