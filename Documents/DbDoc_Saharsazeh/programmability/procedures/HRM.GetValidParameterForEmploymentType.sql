/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 11/07/95 11:46:51 صبح
 ************************************************************/

CREATE PROCEDURE [HRM].[GetValidParameterForEmploymentType](@PersonelID INT, @EmploymentTypeId INT, @ExecDate DATETIME)
AS
	DECLARE @AggID INT
	
	SELECT TOP 1 @AggID = a.AgreementID
	FROM   hrm.Agreement a
	WHERE  a.PersonelID = @personelID
	ORDER BY
	       a.IssueDate DESC
	
	
	DECLARE @lastStatus INT
	
	
	SELECT TOP 1  @lastStatus=cps.[STATUS] FROM hrm.ChangePersonelStatus AS cps
	WHERE cps.PersonelID=@PersonelID
	AND cps.ChangeDate<=@ExecDate
	ORDER BY cps.IssueDate DESC
	
	IF @lastStatus IS NULL OR @lastStatus=3 or @lastStatus=6 OR @lastStatus=100
		SET @AggID=-1
	
	SELECT T.*, ISNULL(T1.Amount, 0) AS Amount
	FROM   (
	           SELECT p.ParameterID,
	                  p.ParameterTypeID,
	                 
	                  CAST(0 AS TINYINT)  AS InterpretationType,
	                  p.Title             AS ParameterName,
	                  cm.IsActive,
	                  ROW_NUMBER() OVER(PARTITION BY cm.ParameterID ORDER BY cm2.StartDate desc ) AS 
	                  Rno
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
	                WHERE  ap.AgreementID = @AggID
	            )T1
	            ON  T1.ParameterID = T.ParameterID
	WHERE  T.rno = 1
	       AND T.IsActive = 1
	
	



