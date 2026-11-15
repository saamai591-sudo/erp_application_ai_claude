-------------------------------------
CREATE   PROC [CNT].SpConfirmStatementUpdate
    @ConfirmStatementID INT ,
    @ContractID INT ,
    @ContractStatementID INT ,
    @Initial BIT ,
    @Amount DECIMAL(30, 4) ,
    @PaidAmount DECIMAL(30, 4) ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT ,
    @PreVoucherID INT ,
    @CurrencyRate DECIMAL(20, 10) ,
    @Number INT ,
    @Date DATE,
	@FinancialPeriodID INT,
    @ConfirmStatus TINYINT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Version <> (   SELECT [Version]
                       FROM   [CNT].[ConfirmStatement]
                       WHERE  [ConfirmStatementID] = @ConfirmStatementID )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10);
        RETURN;
    END;
 
    DECLARE @HasFlow BIT = (SELECT [CNT].[ConfirmStatementHasFlow](@ConfirmStatementID) )
    IF (@HasFlow = 1)
    BEGIN
        RAISERROR('HasFlowItemCanNotEdit', 16, 12);
        RETURN;
    END;

    DECLARE @ContractStatementNumber INT ,
            @Count INT ,
            @msg NVARCHAR(MAX) ,
            @ContractSubject INT ,
            @ContractStatmentType INT,
			@NumberingPattern int;

    SELECT @ContractStatementNumber = Number ,
           @ContractStatmentType = ContractStatementTypeID
    FROM   CNT.ContractStatement
    WHERE  ContractStatementID = @ContractStatementID;

    SELECT @Count = COUNT(1)
    FROM   CNT.ContractStatement cs
    WHERE  cs.ContractID = @ContractID
           AND ContractStatementTypeID = @ContractStatmentType
           AND cs.Number < @ContractStatementNumber
           AND ContractStatementID NOT IN (   SELECT ContractStatementID
                                              FROM   CNT.ConfirmStatement );

	declare @CompanyRoll Tinyint
	select @CompanyRoll = CompanyRoll
	from CNT.Contract
	where ContractID = @ContractID

    IF @Count > 0
        BEGIN
            RAISERROR('CNT_ConfirmContractStatementApprovedNumber', 16, 12);
            RETURN;
        END;

    SET @Version = @Version + 1;

    UPDATE [CNT].[ConfirmStatement]
    SET    [ContractID] = @ContractID ,
           [ContractStatementID] = @ContractStatementID ,
           [Initial] = @Initial ,
           [Amount] = @Amount ,
           [PaidAmount] = @PaidAmount ,
           [LastEditor] = @LastEditor ,
           [LastEditionDate] = @LastEditionDate ,
           [Version] = @Version ,
           [CurrencyRate] = @CurrencyRate ,
           [PreVoucherID] = @PreVoucherID ,
           [Date] = @Date,
		   [FinancialPeriodID]=@FinancialPeriodID,
           [ConfirmStatus] = @ConfirmStatus
    WHERE  [ConfirmStatementID] = @ConfirmStatementID;


	--This part is controlling the change of date and numbering conflicts if exists
	if @CompanyRoll = 2
	begin
		 EXEC cfg.spGetPatternLastNumber
	    @EntityName = 'ConfirmStatement',
	    @SaleAreaID = null,
	    @StationID = NULL,
	    @FinancialPeriodID = @FinancialPeriodID,
	    @SaleTypeID = null,
	    @BranchID = NULL,
	    @Date = @Date,
	    @number = @Number ,
        @NumberingPattern = @NumberingPattern 

	End


    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM   [CNT].[ConfirmStatement]
    WHERE  [ConfirmStatementID] = @ConfirmStatementID;
-- End Return Select <- do not remove

