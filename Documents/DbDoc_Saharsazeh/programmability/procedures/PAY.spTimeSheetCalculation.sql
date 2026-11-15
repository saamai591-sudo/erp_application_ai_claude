CREATE   PROC [PAY].[spTimeSheetCalculation]
(
    @CalculationPersonelIds			NVARCHAR(MAX),
    @CalendarMonthID				INT ,
    @returnError BIT = 0
)

AS
	DECLARE @CalendarMonthEndDate     DATE,
			@PercisionCount           INT,
			@UserID                   INT

	 SELECT @PercisionCount = c.PrecisionCount
	 FROM CFG.Currency AS c
	 WHERE c.CurrencyID = -1

	SET @UserID = cfg.GetuserID()

  BEGIN TRY
            CREATE TABLE #Erorrs
            (
                Code NVARCHAR(MAX),
                Title NVARCHAR(MAX)
            )

            INSERT INTO #Erorrs
	    	EXEC PAY.spTimeSheetControls
	    		 @CalculationPersonelIDs,
	    	     @Type = 1,
	    	     @CalendarMonthID = @CalendarMonthID,
                 @returnError = @returnError
             IF EXISTS (SELECT 1 FROM #Erorrs )
			BEGIN
				SELECT * FROM #Erorrs
                RETURN;
			END
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

	------SelectedCalculationPersonel

	SELECT cp.* 
	INTO   #CalculationPersonel
	FROM   pay.CalculationPersonel AS cp
	WHERE  cp.CalculationPersonelID IN (SELECT VALUE
										FROM   cfg.R_FnCommaStr2Table(@CalculationPersonelIds) AS rfcst)

	----   get personel payrollaccgroup in selected month

	SELECT @CalendarMonthEndDate =  cm.EndDate FROM hrm.CalendarMonth AS cm
	WHERE cm.CalendarMonthID = @CalendarMonthID

	-----Find Sum Amount Per Parameter Per Personel In The Specified Calendar month
    
	SELECT SUM(cr.[Value])                  VALUE,
		   cp.PersonelID,
		   cr.ParameterID
	INTO   #SumCalculatedAmount
	FROM   pay.CalculationResult         AS cr
		   JOIN #CalculationPersonel  AS cp
				ON  cp.CalculationPersonelID = cr.CalculationPersonelID
	GROUP BY
		   cp.PersonelID,
		   cr.ParameterID

	 ----Find  Payroll AccGroup and Parameter  Per Personel    
      
SELECT pac.PayrollAccGroupID,
       pac.SlID,
       pac.ParameterID,
       pac.BalanceType,
       vpvs.PersonelID,
       pac.IsShareable,
       pac.ShareBaseDlTypeId,
       pac.CalendarMonthID
INTO   #PayrollAccGroupTimeSheet 
FROM   pay.vwPayrollAccConfiguration  AS pac
JOIN pay.vwPersonelVoucherSetting AS vpvs ON pac.PayrollAccGroupID = vpvs.PayrollAccGroupID AND pac.CalendarMonthID = vpvs.CalendarMonthID
JOIN acc.AccountLevelSL AS als ON als.SlID = pac.SlID
WHERE  pac.IsShareable = 1
AND als.DlTypeID = pac.ShareBaseDlTypeId
       
   ----Find Sum TimeSheet Value per personel and CalendarMonthID     
SELECT ts.PersonelID,
       ts.CalendarMonthID,
       SUM(ts.[Value])     SumValue
INTO   #SumTimeSheetValue
FROM   pay.TimeSheet    AS ts
WHERE  ts.CalendarMonthID = @CalendarMonthID
GROUP BY
       ts.PersonelID,
       ts.CalendarMonthID 
       
--- Share Values
      
SELECT ROW_NUMBER() OVER(
           PARTITION BY sca.ParameterID,
           ts.PersonelID ORDER BY
           ts.[Value] / stsv.SumValue * sca.[VALUE] DESC
       )                                   rno,
       ts.PersonelID,
       pags.SlID,
       ts.DlID,
       sca.ParameterID,
       ROUND(ts.[Value] / stsv.SumValue * sca.[VALUE], @PercisionCount) Amount,
       ts.TimeSheetId,
       cp.CalculationPersonelID
INTO   #SharedValue
FROM   pay.TimeSheet                    AS ts
JOIN #CalculationPersonel AS cp ON ts.PersonelID = cp.PersonelID AND cp.CalendarMonthID = ts.CalendarMonthID
       JOIN #SumTimeSheetValue          AS stsv
            ON  stsv.PersonelID = ts.PersonelID
       JOIN #SumCalculatedAmount        AS sca
            ON  ts.PersonelID = sca.PersonelID            
       JOIN #PayrollAccGroupTimeSheet           AS pags
            ON   cp.PersonelID = pags.PersonelID
            AND pags.ParameterID = sca.ParameterID            
            AND cp.CalendarMonthID = pags.CalendarMonthID

SELECT sv.PersonelID,
       sv.ParameterID,
       SUM(sv.Amount)     Amount
INTO   #SumSharedValue
FROM   #SharedValue    AS sv
GROUP BY
       sv.PersonelID,
       sv.ParameterID

UPDATE sv
SET    sv.Amount = sv.Amount + (sca.[VALUE] -ssv.Amount)
FROM   #SharedValue AS sv
       JOIN #SumCalculatedAmount AS sca
            ON  sv.PersonelID = sca.PersonelID
            AND sv.ParameterID = sca.ParameterID
       JOIN #SumSharedValue AS ssv
            ON  sv.PersonelID = ssv.PersonelID
            AND sv.ParameterID = ssv.ParameterID
            AND sv.rno = 1

INSERT INTO pay.TimeSheetCalculationResult
(
	-- TimeSheetCalculationResultID -- this column value is auto-generated
	CalendarMonthID,
	PersonelID,
	ParameterID,
	SlID,
	DlID,
	[Value],
	Creator,
	CreationDate,
	CalculationPersonelID
)

SELECT 
@CalendarMonthID,sv.PersonelID,
       sv.ParameterID,
       sv.SlID,
       sv.DlID,
       sv.Amount,
       @UserID,
       GETDATE(),
       sv.CalculationPersonelID
FROM   #SharedValue AS sv
WHERE sv.Amount<>0

INSERT INTO pay.TimeSheetCalculationPersonel
(
	-- TimeSheetCalculationPersonelID -- this column value is auto-generated
	CalculationPersonelID,
	Version,
	Creator,
	CreationDate,
	LastEditor,
	LastEditionDate
)
SELECT sv.CalculationPersonelID,
       0,
       -1,
       GETDATE(),
       -1,
       GETDATE()
FROM   #CalculationPersonel AS sv
GROUP BY
       sv.CalculationPersonelID

--------------------------------------------------------------------------------------------------------
