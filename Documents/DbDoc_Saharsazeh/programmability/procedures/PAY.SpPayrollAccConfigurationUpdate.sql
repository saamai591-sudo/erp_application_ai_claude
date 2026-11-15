CREATE     PROC [PAY].[SpPayrollAccConfigurationUpdate]
    @PayrollAccConfigurationID INT,
    @PayrollAccGroupID INT,
    @ParameterID INT,
    @SlID INT,
    @BalanceType TINYINT,
    @Description NVARCHAR(1024),
    @Description2 NVARCHAR(1024),
    @Version INT,
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
        @CalculationTypeID int,
        @CanEditDecsription bit,
        @IsPayrollVoucherIssued bit;

select 
      @CanEditDecsription=  case
                                when COUNT(*)=1 
                                                then 1
                                else 0
                            end
    from [PAY].[PayrollAccConfiguration]
    where PayrollAccConfigurationID=@PayrollAccConfigurationID AND
                                                                ([Description]<>@Description OR [Description2]<>@Description2)

SELECT  @CalculationTypeID = p.CalculationTypeID
FROM pay.Parameter AS p where ParameterID = @ParameterID
	
SELECT @EndDate= cm.EndDate FROM hrm.CalendarMonth AS cm WHERE cm.CalendarMonthID=@CalendarMonthID

select @IsPayrollVoucherIssued= case
                when EXISTS(
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
					            AND pv.PayrollAccGroupID=@PayrollAccGroupID
					            and cv.VoucherID is not null
			  ) 
                 then 1
                 else 0
            end
	
	IF @IsPayrollVoucherIssued=1 AND @CanEditDecsription=0

BEGIN
	RAISERROR ('GreaterThanThisMonthTheseIsAVoucher',16,12)
	RETURN
	END


IF @Version <> (
       SELECT [Version]
       FROM   [PAY].[PayrollAccConfiguration]
       WHERE  [PayrollAccConfigurationID] = @PayrollAccConfigurationID
   )
    RAISERROR('Version mismatch...', 16, 10)


SET @Version = @Version + 1 

if @IsPayrollVoucherIssued=1 and @CanEditDecsription=1
BEGIN
    UPDATE [PAY].[PayrollAccConfiguration]
    SET    [Description] = @Description,
           Description2=@Description2,
           [Version] = @Version,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate
    WHERE  [PayrollAccConfigurationID] = @PayrollAccConfigurationID
END

ELSE
BEGIN
    UPDATE [PAY].[PayrollAccConfiguration]
    SET    [PayrollAccGroupID] = @PayrollAccGroupID,
           [ParameterID] = @ParameterID,
           [SlID] = @SlID,
           [BalanceType] = @BalanceType,
           [Description] = @Description,
           Description2=@Description2,
           [Version] = @Version,
           [Creator] = @Creator,
           [CreationDate] = @CreationDate,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate,
	       [CalendarMonthID] = @CalendarMonthID,
	       IsActive = @IsActive
    WHERE  [PayrollAccConfigurationID] = @PayrollAccConfigurationID
END
	
		-- Begin Return Select <- do not remove
SELECT  [Version]
FROM   [PAY].[PayrollAccConfiguration]
WHERE  [PayrollAccConfigurationID] = @PayrollAccConfigurationID 
       -- End Return Select <- do not remove
