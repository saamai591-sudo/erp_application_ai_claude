CREATE     PROC [PAY].[SpPayrollAccConfigurationInsert]
    @PayrollAccGroupID INT,
    @ParameterID INT,
    @SlID INT,
    @BalanceType TINYINT,
    @Description NVARCHAR(1024),
    @Description2 NVARCHAR(1024),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@CalendarMonthID int,
	@IsActive bit
			--WITH ENCRYPTION 
AS 
    SET NOCOUNT ON 

    DECLARE @EndDate             DATE,
            @CalculationTypeID int

    SELECT  @CalculationTypeID = p.CalculationTypeID
    FROM pay.Parameter AS p where ParameterID = @ParameterID
	
    SELECT @EndDate= cm.EndDate FROM hrm.CalendarMonth AS cm WHERE cm.CalendarMonthID=@CalendarMonthID
	
	IF EXISTS(
                SELECT cv.CalculationPersonelID
				FROM   pay.CalculationPersonel AS cv
				JOIN hrm.CalendarMonth AS cm
					ON  cm.CalendarMonthID = cv.CalendarMonthID
				OUTER APPLY (
						SELECT TOP 1 
								pvs1.PersonelID,
								pvs1.CalendarMonthID,
								pvs1.PayrollAccGroupID,
								cm1.StartDate,
								cm1.EndDate
						FROM   pay.PersonelVoucherSetting AS pvs1
								JOIN hrm.CalendarMonth AS cm1
									ON  cm1.CalendarMonthID = pvs1.CalendarMonthID
						WHERE cm1.EndDate <= cm.EndDate
						AND pvs1.PersonelID = cv.PersonelID
						ORDER BY cm1.EndDate desc
                                 
					) PV
					WHERE cm.EndDate>=@EndDate
					AND cv.CalculationTypeID=@CalculationTypeID
					AND PV.PayrollAccGroupID=@PayrollAccGroupID
					and cv.VoucherID is not null
			  )

    BEGIN
	    RAISERROR ('GreaterThanThisMonthTheseIsAVoucher',16,12)
	    RETURN
	END
	
    INSERT INTO [PAY].[PayrollAccConfiguration]
      (
        [PayrollAccGroupID],
        [ParameterID],
        [SlID],
        [BalanceType],
        [Description],
        Description2,
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
	    [CalendarMonthID],
	    [IsActive]
      )
    SELECT @PayrollAccGroupID,
           @ParameterID,
           @SlID,
           @BalanceType,
           @Description,
           @Description2,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
	       @CalendarMonthID,
	       @IsActive
	
	-- Begin Return Select <- do not remove
    SELECT [PayrollAccConfigurationID],
           [Version]
    FROM   [PAY].[PayrollAccConfiguration]
    WHERE  [PayrollAccConfigurationID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
