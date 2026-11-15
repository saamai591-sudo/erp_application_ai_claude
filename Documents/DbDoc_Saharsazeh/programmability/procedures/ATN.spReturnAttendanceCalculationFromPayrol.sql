CREATE PROC [ATN].spReturnAttendanceCalculationFromPayrol

(@CalendarMonthID INT, @SelectedPersonel NVARCHAR(MAX))
    
    AS
    
    --	@Type = 1		ForCalculation
    --	@Type = 2			ForDelete
    --	@Type = 3			ForSendingToPayroll
    --	@Type = 4		ForReturnFromPayroll
    
DECLARE @ErrorMessage NVARCHAR(MAX)
    
	DECLARE @ErrorSeverity INT
					, @ErrorState INT;   
    
    
SELECT VALUE PersonelID
INTO   #Personel
FROM   CFG.R_FnCommaStr2Table(@SelectedPersonel)
    
     BEGIN TRY  
		
	EXEC atn.spAttendaceCalculationControls
     @CalendarMonthID = @CalendarMonthID,
     @SelectedPersonel = @SelectedPersonel,
     @Type = 4	

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
    

       
       --- Control 1
       
       ------- check if at least one person has been calculated in payroll
       -- For all operations this Control will be executed   
       
       
      DELETE FROM pmd FROM PAY.ParameterMonthlyData AS pmd
      JOIN pay.Parameter AS p ON p.ParameterID = pmd.ParameterID
      JOIN atn.AttendanceCalculationMethod AS acm ON acm.ParameterID = p.ParameterID
      JOIN #Personel AS p2 ON pmd.PersonnelID = p2.PersonelID 
      WHERE pmd.CalendarMonthID =  @CalendarMonthID
       
UPDATE acp1
SET    acp1.[Status] = 1
FROM   atn.AttendanceCalculationPersonnel AS acp1
       JOIN #Personel p
            ON  acp1.PersonelID = p.PersonelID
WHERE  acp1.CalendarMonthID = @CalendarMonthID
