

CREATE PROCEDURE [PAY].[GetParameterWithEmploymentTypeId]
    (
      @calendarMonthId INT ,
      @employmentTypeId INT
    )
AS
    DECLARE @EndDate DATETIME,
	        @UserID int,
			@Culture VARCHAR(25),
			@CultureNo tinyint

	SELECT @UserID = CFG.GetuserID()
    SET @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SELECT  @EndDate = EndDate
    FROM    HRM.CalendarMonth
    WHERE   CalendarMonthID = @calendarMonthId;

    SELECT Parameter.ParameterID AS Value,
	       case @CultureNo
				when 1 then Pay.Parameter.Title
				when 2 then Pay.Parameter.Title2
	       end as Title,
		   case @CultureNo
				when 1 then pay.Category.Title
				when 2 then pay.Category.Title2
	       end as CategoryTitle,
	pay.Parameter.CategoryID,DataEntryType,Parameter.ParameterID,
	ParameterTypeID,HasEstablishment,OrganizationID,CalculationTypeID,
	ReCalcable
    FROM    PAY.Parameter
            INNER JOIN ( SELECT ParameterID ,
                                IsActive ,
                                ROW_NUMBER() OVER ( PARTITION BY ParameterID ORDER BY EndDate DESC ) AS Rno
                         FROM   PAY.CalculationMethod
                                INNER JOIN HRM.CalendarMonth ON CalendarMonth.CalendarMonthID = CalculationMethod.EfficientCalendarMonthID
                         WHERE  EmploymentTypeID = @employmentTypeId
                                AND (EndDate <= @EndDate OR @EndDate IS null)
                       ) T ON T.ParameterID = Parameter.ParameterID
		INNER JOIN Pay.Category
		ON Category.CategoryID = Parameter.CategoryID
    WHERE   T.Rno = 1
            AND T.IsActive = 1;
	
