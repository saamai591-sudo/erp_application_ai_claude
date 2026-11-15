CREATE PROC [PAY].spDeleteTimeSheetCalculation
( @CalculationPersonelIds NVARCHAR(MAX))
AS

DECLARE @CalendarMonthEndDate     DATE,
        @PercisionCount           INT,
        @UserID                   INT
        
SET @PercisionCount = 0

SET @UserID = cfg.GetuserID()


  BEGIN TRY
	    	EXEC PAY.spTimeSheetControls
	    	    @CalculationPersonelId= @CalculationPersonelIds,
	    	     @Type = 2
	    END TRY  
	    BEGIN CATCH
	    	DECLARE @ErrorMessage      NVARCHAR(4000)
	    	
	    	SELECT @ErrorMessage = 'E_'+ERROR_MESSAGE()
	    	
	    	
	    	RAISERROR (
	    	    @ErrorMessage,	-- Message text.
	    	    16,	-- Severity.
	    	    10 -- State.
	    	);
	    	RETURN;
	    END CATCH



SELECT VALUE CalculationPersonelID
INTO   #SelectedCalculationPersonel
FROM   CFG.R_FnCommaStr2Table(@CalculationPersonelIDs)

SELECT cp2.* INTO #CalculationPersonel
FROM #SelectedCalculationPersonel AS cp
JOIN pay.CalculationPersonel AS cp2 ON cp2.CalculationPersonelID = cp.CalculationPersonelID


DELETE FROM tscr
FROM pay.TimeSheetCalculationResult AS tscr
JOIN #CalculationPersonel AS p ON tscr.CalculationPersonelID = p.CalculationPersonelID
JOIN pay.Parameter AS p2 ON p2.ParameterID = tscr.ParameterID


DELETE FROM tscr
FROM pay.TimeSheetCalculationPersonel  AS tscr
JOIN #CalculationPersonel AS p ON tscr.CalculationPersonelID = p.CalculationPersonelID
