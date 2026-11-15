Create  
     PROCEDURE [PAY].RptFish
(
    @CalendarMonthId  INT,
    @CalcTypeID       VARCHAR(MAX),
    @PersonelID       VARCHAR(MAX) = NULL,
    @SeprateBackpay  BIT =0,
    @isFromCalculation NVARCHAR(5) = 'True'
)

	--WITH ENCRYPTION 
AS

	DECLARE @Hour INT,
			@CultureNo varchar(10),
			@Culture varchar(10)
	
	set @Culture = CFG.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo
	where Culture = @Culture
	
	SELECT @Hour = c.WorkHours
	FROM   HRM.CalendarMonth cm
	       INNER JOIN HRM.Calendar c
	            ON  c.CalendarID = cm.CalendarID
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	PRINT SYSDATETIME()
	SELECT VALUE AS PersonelID INTO #T FROM cfg.R_FnCommaStr2Table(@PersonelID) rfhst
	
	PRINT SYSDATETIME()
	CREATE TABLE #Values
	(
			CalculationPersonelID INT,
			ParameterID INT,
			LoanID int,
			ParameterValueTypeID INT,
			VALUE DECIMAL(30,10),
			
	)

	IF @SeprateBackpay=0
	begin
		INSERT INTO #Values
		SELECT cr1.CalculationPersonelID, cr1.ParameterID,cr1.LoanID,7,SUM(VALUE) AS VALUE
				  FROM 	pay.CalculationResult cr1
				 INNER JOIN pay.CalculationPersonel AS  c
					ON  c.CalculationPersonelID = cr1.CalculationPersonelID
					INNER JOIN #T
					ON #T.PersonelID=c.PersonelID
				WHERE cr1.ParameterValueTypeID IN (7,16) 
				  AND c.CalculationTypeID in (	SELECT VALUE  FROM cfg.R_FnCommaStr2Table(@CalcTypeID) )
			   AND c.CalendarMonthID = @CalendarMonthId
		GROUP BY  cr1.CalculationPersonelID,cr1.ParameterID,cr1.LoanID
		
		
	END
	ELSE 
	
	INSERT INTO #Values
	SELECT cr1.CalculationPersonelID, cr1.ParameterID,cr1.LoanID,cr1.ParameterValueTypeID,VALUE
			  FROM 	pay.CalculationResult cr1
			 INNER JOIN pay.CalculationPersonel c
	            ON  c.CalculationPersonelID = cr1.CalculationPersonelID
	            INNER JOIN #T
	            ON #T.PersonelID=c.PersonelID
			WHERE cr1.ParameterValueTypeID IN (7,16) 
			  AND c.CalculationTypeID in (	SELECT VALUE  FROM cfg.R_FnCommaStr2Table(@CalcTypeID) )
	       AND c.CalendarMonthID = @CalendarMonthId 

	
	

	
	SELECT cp.PersonelID,
	       cr.ParameterID,
	       cr.LoanID,
	       cp.CalculationPersonelID,
	       cr.ParameterValueTypeID,
	       cr.[Value],
	       CASE WHEN cr.ParameterValueTypeID=16 THEN N' معوقه ' ELSE ' ' END
		    + 
		   CASE WHEN @CultureNo = 1 then p.Title else p.Title2 end AS Title,
	       p.CategoryID,
	       p.DataEntryType,
	       CASE 
	            WHEN p.DataEntryType = 2 THEN CFG.ConvertToHourMinute(cr.[Value] * 60.00)
	            WHEN p.DataEntryType = 3 THEN CFG.ConvertToDayHourMinute(cr.[Value]*@Hour, @Hour)
	            ELSE Format(CAST(cr.[Value] AS decimal(36,10)), '#,##0.################')
	       END AS StringValue,
	       CASE 
	            WHEN p.CategoryID = 7 THEN (SELECT  sum(cr2.[Value])
	                                          FROM pay.CalculationResult cr2
	                                        WHERE cr2.ParameterValueTypeID=14 AND cr2.CalculationPersonelID=cr.CalculationPersonelID
	            AND cr2.ParameterID=cr.ParameterID and cr2.LoanID=cr.LoanID
	                                       )
	            ELSE 0
	       END AS RemainValue,po.OrderIndex
	FROM  #Values  cr
	       INNER JOIN pay.Parameter p
	            ON  p.ParameterID = cr.ParameterID
	       INNER JOIN pay.CalculationPersonel AS cp
				ON cr.CalculationPersonelID=cp.CalculationPersonelID     
				LEFT JOIN pay.ParameterOrder AS po ON po.ParameterID = p.ParameterID AND po.OrderType=1
				LEFT JOIN (
					SELECT pp.CalendarMonthID,ppi.PersonnelID,p2.CalculationTypeID FROM pay.PayPreparing AS pp
					JOIN pay.PayrollPaymentType AS ppt ON ppt.PayrollPaymentTypeID = pp.PayrollPaymentTypeID
					JOIN pay.PayrollPaymentTypeParameter AS pptp ON pptp.PayrollPaymentTypeID = ppt.PayrollPaymentTypeID
					JOIN pay.Parameter AS p2 ON p2.ParameterID = pptp.ParameterID
					JOIN pay.PayPreparingItem AS ppi ON ppi.PayPreparingID = pp.PayPreparingID
					GROUP BY  pp.CalendarMonthID,ppi.PersonnelID,p2.CalculationTypeID) prep ON cp.PersonelID = prep.PersonnelID AND cp.CalendarMonthID = prep.CalendarMonthID
					AND p.CalculationTypeID = prep.CalculationTypeID
					
	WHERE cr.[Value] <> 0
	       --AND p.CategoryID IN (1, 2, 3, 7)
	       AND (@isFromCalculation = 'True' OR prep.CalendarMonthID IS NOT NULL) 
	ORDER BY
	       cp.PersonelID,po.OrderIndex,p.ParameterID


---------End of #9108
