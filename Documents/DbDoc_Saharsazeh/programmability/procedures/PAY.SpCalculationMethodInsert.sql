CREATE PROC [PAY].[SpCalculationMethodInsert] 
    @ParameterID INT,
    @EmploymentTypeID INT,
    @GenerateCalendarMonthID INT,
    @EfficientCalendarMonthID INT,
    @IsActive BIT,
    @IsTaxable BIT,
    @IsInsuranceable BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME

--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
 
	DECLARE @CalculationTypeID INT,
			@GenerateCalendarMonthStartDate SMALLDATETIME,
			@EfficientCalendarMonthStartDate SMALLDATETIME

	SELECT @CalculationTypeID = CalculationTypeID FROM PAY.Parameter
	WHERE ParameterID = @ParameterID

	SELECT @GenerateCalendarMonthStartDate = cm.StartDate
	FROM [HRM].[CalendarMonth] cm 
	WHERE CalendarMonthID = @GenerateCalendarMonthID

	SELECT @EfficientCalendarMonthStartDate = cm.StartDate
	FROM [HRM].[CalendarMonth] cm 
	WHERE CalendarMonthID = @EfficientCalendarMonthID

	EXEC pay.spCalculationMethodControls
	@Type = 1,
		@ParameterID = @ParameterID,
		@GenerateCalendarMonthID = @GenerateCalendarMonthID,
		@EfficientCalendarMonthID = @EfficientCalendarMonthID,
		@EmploymentTypeID = @EmploymentTypeID,
		@CalculationTypeID = @CalculationTypeID,
		@OldGenerateCalendarMonthID = NULL,
		@IsActive = @IsActive
	
    INSERT INTO [PAY].[CalculationMethod]
      (
        [ParameterID],
        [EmploymentTypeID],
        [GenerateCalendarMonthID],
        [EfficientCalendarMonthID],
        [IsActive],IsTaxable,IsInsuranceable,
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
      )
    SELECT @ParameterID,
           @EmploymentTypeID,
           @GenerateCalendarMonthID,
           @EfficientCalendarMonthID,
           @IsActive,@IsTaxable,@IsInsuranceable,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate
	
	    -- Begin Return Select <- do not remove
    SELECT [CalculationMethodID],
           [Version]
    FROM   [PAY].[CalculationMethod]
    WHERE  [CalculationMethodID] = SCOPE_IDENTITY()
           -- End Return Select <- do not remove
