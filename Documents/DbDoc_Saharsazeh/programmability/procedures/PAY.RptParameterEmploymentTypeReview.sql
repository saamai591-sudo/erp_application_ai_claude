

CREATE   PROCEDURE [PAY].[RptParameterEmploymentTypeReview]
(
	@CalculationMethodIds VARCHAR(MAX)=null, @CalendarMonthId INT)
AS
	DECLARE @StartDate DATETIME

	SELECT @StartDate = cm.StartDate
	FROM   hrm.CalendarMonth AS cm
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	DECLARE @Culture varchar(25),
		@CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT DISTINCT et.EmploymentTypeID,et.Code,
	       case when @CultureNo = 1 then et.Title
	            when @CultureNo = 2 then et.Title2
	       end as Title
	FROM   pay.CalculationMethod          AS cm
	       INNER JOIN HRM.CalendarMonth   AS cm2
	            ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	       INNER JOIN HRM.EmploymentType  AS et
	            ON  et.EmploymentTypeID = cm.EmploymentTypeID
	WHERE  @CalculationMethodIds IS NULL
	       AND cm.IsActive = 1
	       OR  cm.CalculationMethodID IN (SELECT VALUE
	                                      FROM   cfg.R_FnCommaStr2Table(@CalculationMethodIds) AS rfcst)
	       AND cm2.StartDate <= @StartDate
	    
	
 
  

