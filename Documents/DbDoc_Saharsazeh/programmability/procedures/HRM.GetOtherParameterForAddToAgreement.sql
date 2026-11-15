
-----------------------------------------------------------
CREATE   PROCEDURE Hrm.GetOtherParameterForAddToAgreement
(
    @EmploymentTypeId     INT,
    @ExecDate             DATETIME,
    @AgreementTypeId      TINYINT
)
AS
	DECLARE @PaymentSystemInstalled BIT
	
	SELECT @PaymentSystemInstalled = ConfigValue
	FROM   cfg.Configuration c
	WHERE  c.ConfigKey = 'IsPaymentSystemInstalled'
	
	IF @PaymentSystemInstalled = 1
	BEGIN
	    SELECT ati.ParameterID,
	           p.ParameterTypeID,
	           ati.InterpretationType,
	           p.Title  AS ParameterName
	    FROM   hrm.AgreementTypeInterpretation ati
	           INNER JOIN hrm.EmploymentType et
	                ON  et.PaymentSystemID = ati.PaymentSystemID
	           INNER JOIN pay.Parameter p
	                ON  p.ParameterID = ati.ParameterID
	        
	    WHERE  ati.AgreementTypeID = @AgreementTypeId
	           AND et.EmploymentTypeID = @EmploymentTypeId
	END
	ELSE
	BEGIN
	    SELECT T.ParameterID,
	           T.ParameterName,
	           T.ParameterTypeID,
			   ISNULL(T1.Amount, 0) AS Amount,
			   CAST(0 AS TINYINT)  AS InterpretationType
	    FROM   (
	               SELECT p.ParameterID,
	                      p.ParameterTypeID,
	                      CAST(0 AS TINYINT) AS InterpretationType,
	                      p.Title AS ParameterName,
	                      cm.IsActive,
	                      ROW_NUMBER() OVER(PARTITION BY cm.ParameterID ORDER BY cm2.StartDate DESC) AS Rno
	               FROM   pay.CalculationMethod AS cm
	                      INNER JOIN PAY.Parameter AS p
	                           ON  p.ParameterID = cm.ParameterID
	                      INNER JOIN HRM.CalendarMonth AS cm2
	                           ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	               WHERE  p.ParameterTypeID = 4
	                      AND cm.EmploymentTypeID = @EmploymentTypeId
	                      AND cm2.StartDate <= @ExecDate
	           )T
			   LEFT JOIN (
							SELECT ap.ParameterID,ap.Amount
							FROM   hrm.AgreementParameter ap
						  )T1
							ON T1.ParameterID = T.ParameterID
		WHERE  T.rno = 1
	    AND T.IsActive = 1
	END;
