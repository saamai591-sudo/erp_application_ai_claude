

CREATE   PROCEDURE [PAY].[RptParameterParameterReview]
(@employmentTypeIds VARCHAR(MAX)=null, @CalendarMonthId INT)
AS
	DECLARE @StartDate DATETIME,@Culture varchar(25),
		@CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT @StartDate = cm.StartDate
	FROM   hrm.CalendarMonth AS cm
	WHERE  cm.CalendarMonthID = @CalendarMonthId
	
	
	SELECT T.CalculationMethodID,
		 p.ParameterID,	       
		   case when @CultureNo = 1 then p.Title
	            when @CultureNo = 2 then p.Title2
	       end as Title, 
		   case when @CultureNo = 1 then c.Title
	            when @CultureNo = 2 then c.Title2
	       end as CategoryTitle, 
		   case when @CultureNo = 1 then pt.Title
	            when @CultureNo = 2 then pt.Title2
	       end as ParameterTypeTitle, 
		   case when @CultureNo = 1 then o.Title
	            when @CultureNo = 2 then o.Title2
	       end as OrganizationTitle, 
		   case when @CultureNo = 1 then ct.Title
	            when @CultureNo = 2 then ct.Title2
	       end as CalculationTypeTitle, 
	       T.IsTaxable,
	       T.IsInsuranceable,
	       p.ReCalcable,
		   case when @CultureNo = 1 then et.Title
	            when @CultureNo = 2 then et.Title2
	       end as EmploymentTypeTitle, 
	       cm.MonthName + ' ' + CAST(c2.[Year] AS VARCHAR(10)) AS CalendarTitle
	FROM   (
	           SELECT cm.CalculationMethodID,
	                  cm.ParameterID,
	                  cm.EmploymentTypeID,
	                  cm.IsTaxable,
	                  cm.IsInsuranceable,
	                  cm.EfficientCalendarMonthID,
	                  ROW_NUMBER() OVER(
	                      PARTITION BY cm.ParameterID,
	                      cm.EmploymentTypeID ORDER BY cm2.StartDate DESC
	                  ) AS Rno
	           FROM   pay.CalculationMethod AS cm
	                  INNER JOIN HRM.CalendarMonth AS cm2
	                       ON  cm2.CalendarMonthID = cm.EfficientCalendarMonthID
	           WHERE  @employmentTypeIds IS NULL
	                  AND cm.IsActive = 1
	                  OR  cm.EmploymentTypeID IN (SELECT VALUE
	                                              FROM   cfg.R_FnCommaStr2Table(@employmentTypeIds) AS rfcst)
	                  AND cm2.StartDate <= @StartDate
	       )T
	       INNER JOIN pay.Parameter       AS p
	            ON  p.ParameterID = T.ParameterID
	       INNER JOIN PAY.Category        AS c
	            ON  c.CategoryID = p.CategoryID
	       INNER JOIN PAY.ParameterType   AS pt
	            ON  pt.ParameterTypeID = p.ParameterTypeID
	       INNER JOIN PAY.CalculationType AS ct
	            ON  ct.CalculationTypeID = p.CalculationTypeID
	       INNER JOIN hrm.EmploymentType  AS et
	            ON  et.EmploymentTypeID = T.EmploymentTypeID
	       INNER JOIN hrm.CalendarMonth   AS cm
	            ON  cm.CalendarMonthID = T.EfficientCalendarMonthID
	       INNER JOIN HRM.Calendar        AS c2
	            ON  c2.CalendarID = cm.CalendarID
	       LEFT JOIN HRM.Organization     AS o
	            ON  o.OrganizationID = p.OrganizationID
	WHERE  T.Rno = 1
	    

