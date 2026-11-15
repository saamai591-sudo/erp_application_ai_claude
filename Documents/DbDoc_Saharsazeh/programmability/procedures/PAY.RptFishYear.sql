
----------------------------------------------------
CREATE     PROCEDURE [PAY].RptFishYear
(
    @CalendarMonthId     INT,
    @CalcTypeID          INT,
    @PersonelID          VARCHAR(MAX) = NULL
)

--WITH ENCRYPTION
AS
	DECLARE @Hour           INT,
	        @CalendarId     INT,
	        @StartDate      DATE
	
	SELECT @Hour = c.WorkHours,
	       @StartDate      = cm.StartDate,
	       @CalendarId     = c.CalendarID
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	PRINT SYSDATETIME()
	SELECT VALUE AS PersonelID
	INTO   #T
	FROM   cfg.R_FnCommaStr2Table(@PersonelID) rfhst
	
	PRINT SYSDATETIME()
	CREATE TABLE #Values
	(
		ParameterID              INT,
		ParameterValueTypeID     INT,
		PersonelID               INT,
		VALUE                    DECIMAL(30, 10),
	)
	
	
	INSERT INTO #Values
	SELECT cr1.ParameterID,
	       7,
	       cp.PersonelID,
	       SUM(VALUE)                    AS VALUE
	FROM   pay.CalculationResult cr1
	       INNER JOIN pay.CalculationPersonel AS cp
	            ON  cr1.CalculationPersonelID = cp.CalculationPersonelID
	       INNER JOIN #T
	            ON  #T.PersonelID = cp.PersonelID
	       INNER JOIN HRM.CalendarMonth  AS cm
	            ON  cm.CalendarMonthID = cp.CalendarMonthID
	WHERE  cr1.ParameterValueTypeID IN (7, 16)
	       AND cp.CalculationTypeID = @CalcTypeID
	       AND cm.CalendarID = @CalendarId
	       AND cm.StartDate <= @StartDate
	GROUP BY
	       cp.PersonelID,
	       cr1.ParameterID
	SELECT cr.PersonelID,
	       cr.ParameterID,
	       cr.ParameterValueTypeID,
	       cr.[Value],
	       p.Title  AS Title,
	       p.CategoryID,
	       p.DataEntryType,
	       CASE 
	            WHEN p.DataEntryType = 2 THEN CFG.ConvertToHourMinute(cr.[Value] * 60.00)
	            WHEN p.DataEntryType = 3 THEN CFG.ConvertToDayHourMinute(cr.[Value] * @Hour, @Hour)
	            ELSE CAST(CAST(cr.[Value] AS DECIMAL(36,0)) AS VARCHAR(512))
	       END      AS StringValue,
	       0        AS RemainValue
	FROM   #Values cr
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = cr.ParameterID
	WHERE  cr.[Value] <> 0
	       AND p.CategoryID IN (1, 2, 3)
	ORDER BY
	       cr.PersonelID,
	       p.ParameterID
