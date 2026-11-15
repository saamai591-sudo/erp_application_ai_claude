CREATE PROC [PAY].[SpCalculationMethodUpdate]
    @CalculationMethodID INT,
    @ParameterID INT,
    @EmploymentTypeID INT,
    @GenerateCalendarMonthID INT,
    @EfficientCalendarMonthID INT,
    @IsActive BIT,
    @IsTaxable BIT,
    @IsInsuranceable BIT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME

--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 

    IF @Version = (
           SELECT [Version]
           FROM   [PAY].[CalculationMethod]
           WHERE  [CalculationMethodID] = @CalculationMethodID
       )
    BEGIN
        DECLARE @CalculationTypeID               INT,
                @OldGenerateCalendarMonthID     INT
    
        SELECT @CalculationTypeID = CalculationTypeID
        FROM   PAY.Parameter
        WHERE  ParameterID = @ParameterID
    
        SELECT @OldGenerateCalendarMonthID = cm.GenerateCalendarMonthID
        FROM   pay.CalculationMethod cm
        WHERE  cm.CalculationMethodID = @CalculationMethodID
    
      EXEC pay.spCalculationMethodControls
      @Type = 2,
  	    @ParameterID = @ParameterID,
  	    @GenerateCalendarMonthID = @GenerateCalendarMonthID,
  	    @EfficientCalendarMonthID = @EfficientCalendarMonthID,
  	    @EmploymentTypeID = @EmploymentTypeID,
  	    @CalculationTypeID = @CalculationTypeID,
  	    @OldGenerateCalendarMonthID = @OldGenerateCalendarMonthID,
  	    @CalculationMethodID = @CalculationMethodID,
  	    @IsActive = @IsActive
    
        UPDATE [PAY].[CalculationMethod]
        SET    [ParameterID] = @ParameterID,
               [EmploymentTypeID] = @EmploymentTypeID,
               [GenerateCalendarMonthID] = @GenerateCalendarMonthID,
               [EfficientCalendarMonthID] = @EfficientCalendarMonthID,
               [IsActive] = @IsActive,
               [Version] = @Version,
               [Creator] = @Creator,
               [CreationDate] = @CreationDate,
               [LastEditor] = @LastEditor,
               [LastEditionDate] = @LastEditionDate,
               IsTaxable = @IsTaxable,
               IsInsuranceable = @IsInsuranceable
        WHERE  [CalculationMethodID] = @CalculationMethodID
    
        -- Begin Return Select <- do not remove
        SELECT  [Version]
        FROM   [PAY].[CalculationMethod]
        WHERE  [CalculationMethodID] = @CalculationMethodID 
               -- End Return Select <- do not remove
    END
