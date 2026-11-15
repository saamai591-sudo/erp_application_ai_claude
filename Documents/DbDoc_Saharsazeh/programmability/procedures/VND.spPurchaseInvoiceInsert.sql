CREATE    PROC [VND].[spPurchaseInvoiceInsert]
    @BaseType TINYINT ,
    @DlID BIGINT ,
    @BranchID INT ,
    @FinancialPeriodID INT ,
    @Type TINYINT ,
    @InvoiceNumber NVARCHAR(100) ,
    @InvoiceDate DATE ,
    @Number INT ,
    @Date DATE ,
    @CurrencyID INT ,
    @CurrencyRate DECIMAL(36, 10) ,
    @TotalPrice DECIMAL(36, 10) ,
    @TotalDiscount DECIMAL(36, 10) ,
    @TotalTax DECIMAL(36, 10) ,
    @TotalDuty DECIMAL(36, 10) ,
    @TotalNetPrice DECIMAL(36, 10) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @PreVoucherID INT ,
    @ExchangeManner TINYINT,
	@Status TINYINT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @StartNum INT = NULL ,
            @EndNum INT = NULL ,
            @ResetBranch BIT = 0 ,
            @ResetType BIT = 0 ,
            @DocumentNumID INT ,
            @DocumentNumTypeID INT ,
            @Message NVARCHAR(MAX),
            @CompanyId INT;

    SELECT @CompanyId=CompanyID 
    FROM CFG.Branch 
    WHERE BranchID=@BranchID


	EXEC CFG.CheckWithVatAndSeason @Date = @Date , 
	                               @FinancialPeriodId = @FinancialPeriodID, 
                                   @CompanyId=@CompanyId
	

    SELECT @DocumentNumTypeID = DocumentNumTypeID
    FROM   [CFG].[DocumentNumType]
    WHERE  EngName = 'PurchaseInvoice';

    SELECT @StartNum = StartNum ,
           @EndNum = EndNum ,
           @DocumentNumID = DocumentNumID
    FROM   CFG.DocumentNum
    WHERE  DocumentNumTypeID = @DocumentNumTypeID
           AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS (   SELECT *
                  FROM   CFG.DocumentNumResetNumberBase a
				  join cfg.DocumentNumResetNumberBaseType b
					on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
                  WHERE  DocumentNumID = @DocumentNumID
                    AND  b.EngName = 'Type' )
        BEGIN
            SET @ResetType = 1;
        END;


    IF EXISTS (   SELECT *
                  FROM   CFG.DocumentNumResetNumberBase a
				  join cfg.DocumentNumResetNumberBaseType b
					on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
                  WHERE  DocumentNumID = @DocumentNumID
                    AND  b.EngName = 'Branch' )
        BEGIN
            SET @ResetBranch = 1;
        END;

    IF (   @Number = 0
           OR @Number IS NULL )
        BEGIN
            SET @Number = ISNULL(
                          (   SELECT MAX(Number) + 1
                              FROM   [VND].[PurchaseInvoice]
                              WHERE  FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetType = 0   OR [Type] = @Type )
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
						  ) ,
                          @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS (   SELECT 1
                            FROM   [VND].[PurchaseInvoice]
                            WHERE  FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetType = 0   OR [Type] = @Type )
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
                                AND Number = @Number 
						)
				)
                BEGIN
                    RAISERROR('NumberIsDuplicate', 16, 12);
                    RETURN;
                END;
        END;

    IF (   @Number >= @StartNum
           AND (   @EndNum IS NULL
                   OR @Number <= @EndNum ))
        BEGIN

            INSERT INTO [VND].[PurchaseInvoice] ( [BaseType] ,
                                                  [DlID] ,
                                                  [BranchID] ,
                                                  [FinancialPeriodID] ,
                                                  [Type] ,
                                                  [InvoiceNumber] ,
                                                  [InvoiceDate] ,
                                                  [Number] ,
                                                  [Date] ,
                                                  [CurrencyID] ,
                                                  [CurrencyRate] ,
                                                  [TotalPrice] ,
                                                  [TotalDiscount] ,
                                                  [TotalTax] ,
                                                  [TotalDuty] ,
                                                  [TotalNetPrice] ,
                                                  [Creator] ,
                                                  [CreationDate] ,
                                                  [LastEditor] ,
                                                  [LastEditionDate] ,
                                                  [Version] ,
                                                  [PreVoucherID] ,
                                                  [ExchangeManner] ,
												  [Status])
                        SELECT @BaseType ,
                               @DlID ,
                               @BranchID ,
                               @FinancialPeriodID ,
                               @Type ,
                               @InvoiceNumber ,
                               @InvoiceDate ,
                               @Number ,
                               @Date ,
                               @CurrencyID ,
                               @CurrencyRate ,
                               @TotalPrice ,
                               @TotalDiscount ,
                               @TotalTax ,
                               @TotalDuty ,
                               @TotalNetPrice ,
                               @Creator ,
                               @CreationDate ,
                               @LastEditor ,
                               @LastEditionDate ,
                               0 ,
                               @PreVoucherID ,
                               @ExchangeManner,
							   @Status;

            SELECT [PurchaseInvoiceID] ,
                   [Version]  ,
                    [Number]
            FROM   [VND].[PurchaseInvoice]
            WHERE  [PurchaseInvoiceID] = SCOPE_IDENTITY();

        END;
    ELSE
    BEGIN
        RAISERROR('InvalidNumberRange', 16, 12);
    END;
