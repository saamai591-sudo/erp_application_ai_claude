
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v6.3.153
 * Time: 06/18/2015 04:34:31 ب.ظ
 ************************************************************/

CREATE PROCEDURE [PAY].[CopyemplymentTypeParameters]
(
    @FromEmploymentTypeID     INT,
    @ToEmploymentTypeID       INT,
    @CalendarMonthID          INT
)

--with encryption
AS

DECLARE @message NVARCHAR(1024)
IF EXISTS (

SELECT 1 FROM pay.CalculationMethod
WHERE EmploymentTypeID=@ToEmploymentTypeID


)
BEGIN


	SET @message = 'E_' + N'این نوع استخدام دارای پارامتر می باشد.' +
	        CHAR(13) + CHAR(10)
	    
	    
	    RAISERROR (
	        @message,	-- Message text.
	        16,	-- Severity,
	        10
	    ); --
	    
	    RETURN

End

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ

DECLARE @maxId  INT

DECLARE @UserId INT
SELECT @UserId=cfg.GetuserID()


SELECT @maxId=MAX(cm.CalculationMethodID)
FROM pay.CalculationMethod cm

SELECT *,ROW_NUMBER() OVER (ORDER BY T.CalculationMethodID)+@maxId AS NewCalculationMethodID
INTO #T FROM (
	SELECT cm.*,
	       ROW_NUMBER() OVER(PARTITION BY parameterID ORDER BY cm2.StartDate DESC)
	       Rno
	FROM   pay.CalculationMethod cm
	       INNER JOIN HRM.CalendarMonth cm2
	            ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	WHERE  cm.EmploymentTypeID = @FromEmploymentTypeID
	)T
WHERE T.Rno=1
AND T.IsActive=1


SELECT @maxId=MAX(f.FormulaID)
FROM pay.Formula f

SELECT f.*,ROW_NUMBER() OVER(ORDER BY f.FormulaID)+@maxId  AS newFormulaID
INTO #T2
  FROM pay.Formula f
INNER JOIN #T
ON f.CalculationMethodID=#T.CalculationMethodID


SET IDENTITY_INSERT pay.CalculationMethod ON

INSERT INTO Pay.CalculationMethod
(
	 CalculationMethodID ,
	ParameterID,
	EmploymentTypeID,
	GenerateCalendarMonthID,
	EfficientCalendarMonthID,
	IsActive,
	IsTaxable,
	IsInsuranceable,
	Version,
	Creator,
	CreationDate,
	LastEditor,
	LastEditionDate
)
SELECT 
	NewCalculationMethodID ,
	ParameterID,
	@ToEmploymentTypeID,
	@CalendarMonthID,
	@CalendarMonthID,
	IsActive,
	IsTaxable,
	IsInsuranceable,
	1,
	@UserId,
	GETDATE(),
	@UserId,
	GETDATE()
 FROM #T

SET IDENTITY_INSERT pay.CalculationMethod OFF

SET IDENTITY_INSERT pay.Formula ON


INSERT INTO pay.Formula
(
	 FormulaID ,
	CalculationMethodID,
	Title,
	Expression,
	Condition,
	SQLExpression,
	SQLCondition,
	Version,
	Creator,
	CreationDate,
	LastEditor,
	LastEditionDate
)
SELECT  NewFormulaID ,
	#T.NewCalculationMethodID,
	Title,
	Expression,
	Condition,
	SQLExpression,
	SQLCondition,
		1,
	@UserId,
	GETDATE(),
	@UserId,
	GETDATE()
FROM #T2
INNER JOIN #T
ON #t2.CalculationMethodID=#t.CalculationMethodID

SET IDENTITY_INSERT pay.Formula OFF


INSERT INTO Pay.FormulaParameter
(
	-- FormulaParameterID -- this column value is auto-generated
	FormulaID,
	ParameterID,
	ParameterValueTypeID,
	CalculationAggregateFunctionID,
	Version,
	Creator,
	CreationDate,
	LastEditor,
	LastEditionDate
)
SELECT  #T2.NewFormulaID,
	ParameterID,
	ParameterValueTypeID,
	CalculationAggregateFunctionID,
		1,
	@UserId,
	GETDATE(),
	@UserId,
	GETDATE()
FROM pay.FormulaParameter fp
INNER JOIN #T2
ON fp.FormulaID=#T2.FormulaID



