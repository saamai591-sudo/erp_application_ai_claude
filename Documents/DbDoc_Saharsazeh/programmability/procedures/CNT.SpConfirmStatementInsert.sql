-------------------------------------
CREATE   PROC [CNT].SpConfirmStatementInsert
    @ContractID INT ,
    @ContractStatementID INT ,
    @Initial BIT ,
    @Amount DECIMAL(30, 4) ,
    @PaidAmount DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @PreVoucherID INT ,
    @CurrencyRate DECIMAL(20, 10) ,
    @Number INT ,
    @Date DATE ,
	@FinancialPeriodID INT,
    @ConfirmStatus TINYINT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @ContractStatementNumber     INT,
            @Count                       INT,
            @msg                         NVARCHAR(MAX),
            @ContractStatmentType        INT,
            @EngName                     NVARCHAR(250) = 'ConfirmStatement',
            @NumberingPattern            INT ;

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

	declare @CompanyRoll TINYINT,
			@BranchID int
	select @CompanyRoll = CompanyRoll,@BranchID = BranchID
	from CNT.Contract
	where ContractID = @ContractID

    IF @Count > 0
    BEGIN
        RAISERROR('CNT_ConfirmContractStatementApprovedNumber', 16, 12);
        RETURN;
    END;

	update b
	set Status = 2
	from cnt.ContractStatementDetail a
	join vnd.PurchaseInvoice b on a.BaseDocumentType = 2 and a.BaseDocumentID = b.PurchaseInvoiceID
	where ContractStatementID = @ContractStatementID

    INSERT INTO [CNT].[ConfirmStatement] 
	( [ContractID] ,
	    [ContractStatementID] ,
	    [Initial] ,
	    [Amount] ,
	    [PaidAmount] ,
	    [Creator] ,
	    [CreationDate] ,
	    [LastEditor] ,
	    [LastEditionDate] ,
	    [Version] ,
	    [CurrencyRate] ,
	    [PreVoucherID] ,
	    [Number] ,
	    [Date],
	    [FinancialPeriodID],
        [ConfirmStatus])
    SELECT @ContractID ,
        @ContractStatementID ,
        @Initial ,
        @Amount ,
        @PaidAmount ,
        @Creator ,
        @CreationDate ,
        @Creator ,
        @CreationDate ,
        0 ,
        @CurrencyRate ,
        @PreVoucherID ,
        0 ,
        @Date,
	    @FinancialPeriodID,
        @ConfirmStatus
					   
    DECLARE @ConfirmStatementID INT = SCOPE_IDENTITY();
       
    IF @Initial = 1
    BEGIN
        SET @Number = 0
    END
    ELSE IF @CompanyRoll = 2
    BEGIN
        EXEC cfg.spGetPatternLastNumber
	    @EntityName = @engName,
	    @SaleAreaID = null,
	    @StationID = NULL,
	    @FinancialPeriodID = @FinancialPeriodID,
	    @SaleTypeID = null,
	    @BranchID = NULL,
	    @Date = @Date,
	    @number = @Number OUTPUT,
        @NumberingPattern = @NumberingPattern  OUTPUT
    END
    ELSE IF @CompanyRoll = 1 
    BEGIN
        SET @Number = ISNULL((   SELECT MAX(cs.Number)
                                FROM   CNT.vwConfirmStatement_CostType  AS cs ) ,
                            0) + 1;
    END;
       
	UPDATE cnt.ConfirmStatement
	SET Number = @Number
	WHERE ConfirmStatementID = @ConfirmStatementID 
		
	UPDATE cfg.NumberingPattern
	SET LastAssignedNumber = @Number
	WHERE NumberingPatternID = @NumberingPattern
		
    -- Begin Return Select <- do not remove
    SELECT [ConfirmStatementID] ,
           [Version] ,
           [Number] 
    FROM   [CNT].[ConfirmStatement]
    WHERE  [ConfirmStatementID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove

