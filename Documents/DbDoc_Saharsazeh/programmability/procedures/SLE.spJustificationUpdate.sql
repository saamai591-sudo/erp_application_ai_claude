CREATE      PROC [SLE].[spJustificationUpdate]
    @JustificationID INT ,
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @AddressID INT ,
    @Number INT ,
    @Date DATETIME ,
    @CurrencyID INT ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalNetPrice DECIMAL(30, 4) ,
    @Status TINYINT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@SaleAreaId int
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

	if @SaleAreaID is null
	set @SaleAreaID = -1

    IF @Version <> (   SELECT [Version]
                       FROM   [SLE].[Justification]
                       WHERE  [JustificationID] = @JustificationID )
        RAISERROR('Version mismatch...', 16, 10);

    DECLARE @isInFlow BIT = 0;

    IF EXISTS (   SELECT 1
                  FROM   SLE.Justification AS j
                         JOIN SLE.JustificationItem AS ji ON ji.JustificationID = j.JustificationID
                  WHERE  SLE.JustificationItemHasFlow(ji.JustificationItemID) = 1
                         AND j.JustificationID = j.JustificationID )
        SET @isInFlow = 1;


    DECLARE @orgFinancialPeriodID INT ,
            @orgBaseDocument TINYINT ,
            @orgBranchID INT ,
            @orgCustomerID BIGINT ,
            @orgAddressID INT ,
            @orgNumber INT ,
            @orgDate DATE ,
            @orgCurrencyID INT ,
            @orgSaleTypeID INT,
			@ResetSaleArea bit = 0

    SELECT @orgFinancialPeriodID = j.FinancialPeriodID ,
           @orgBaseDocument = j.BaseDocument ,
           @orgBranchID = j.BranchID ,
           @orgCustomerID = j.CustomerID ,
           @orgAddressID = j.AddressID ,
           @orgNumber = j.Number ,
           @orgDate = j.[Date] ,
           @orgCurrencyID = j.CurrencyID ,
           @orgSaleTypeID = j.SaleTypeID
    FROM   SLE.Justification AS j;

    IF @isInFlow = 1
       AND (   @orgFinancialPeriodID <> @FinancialPeriodID
               OR @orgBaseDocument <> @BaseDocument
               OR @orgBranchID <> @BranchID
               OR @orgCustomerID <> @CustomerID
               OR @orgAddressID <> @AddressID
               OR @orgNumber <> @Number
               OR @orgDate <> @Date
               OR @orgCurrencyID <> @CurrencyID
               OR @orgSaleTypeID <> @SaleTypeId )
        BEGIN
            RAISERROR('Retry', 16, 12);
            RETURN;
        END;

    DECLARE @StartNum INT = NULL ,
            @EndNum INT = NULL ,
            @Branch BIT = 0 ,
            @ResetType BIT = 0 ,
            @DocumentNumID INT ,
            @Message NVARCHAR(MAX);

    SELECT @StartNum = StartNum ,
           @EndNum = EndNum ,
           @DocumentNumID = DocumentNumID
    FROM   CFG.DocumentNum
    WHERE  DocumentNumTypeID = 12
           AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS (   SELECT 1
                  FROM   CFG.DocumentNumResetNumberBase
                  WHERE  DocumentNumID = @DocumentNumID
                         AND DocumentNumResetNumberBaseTypeID = 5 )
        BEGIN
            SET @Branch = 1;
        END;

    IF EXISTS (   SELECT 1
                  FROM   CFG.DocumentNumResetNumberBase
                  WHERE  DocumentNumID = @DocumentNumID
                         AND DocumentNumResetNumberBaseTypeID = 6 )
        BEGIN
            SET @ResetType = 1;
        END;

IF EXISTS
(
    SELECT 1
    FROM CFG.DocumentNumResetNumberBase a
	join [CFG].[DocumentNumResetNumberBaseType] b
		on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
    WHERE DocumentNumID = @DocumentNumID
			AND b.EngName = 'SaleArea'
)
BEGIN
    SET @ResetSaleArea = 1;
END;

    IF (   @Number = 0
           OR @Number IS NULL )
        SET @Number = ISNULL(
                      (   SELECT MAX(Number) + 1
                          FROM   [SLE].[Justification]
                          WHERE  FinancialPeriodID = @FinancialPeriodID
                                 AND (   @Branch = 0
                                         OR BranchID = @BranchID )
                                 AND (   @ResetType = 0
                                         OR [SaleTypeID] = @SaleTypeId )
                            AND
                            (
                                @ResetSaleArea = 0
                                OR [SaleAreaID] = @SaleAreaId
                            )										 
										 ) ,
                      @StartNum);

    IF (   @Number >= @StartNum
           AND (   @EndNum IS NULL
                   OR @Number <= @EndNum ))
        BEGIN
            UPDATE [SLE].[Justification]
            SET    [BaseDocument] = @BaseDocument ,
                   [SaleTypeID] = @SaleTypeId ,
                   [BranchID] = @BranchID ,
                   [CustomerID] = @CustomerID ,
                   [AddressID] = @AddressID ,
                   [Number] = @Number ,
                   [Date] = @Date ,
                   [CurrencyID] = @CurrencyID ,
                   [TotalPrice] = @TotalPrice ,
                   [TotalDiscount] = @TotalDiscount ,
                   [TotalNetPrice] = @TotalNetPrice ,
                   [Status] = @Status ,
                   [Version] = @Version + 1 ,
                   [LastEditor] = @LastEditor ,
                   [LastEditionDate] = @LastEditionDate,
				   [SaleAreaId] = @SaleAreaId
            WHERE  [JustificationID] = @JustificationID;

            -- Begin Return Select <- do not remove
            SELECT  [Version]  ,
                   [Number]
            FROM   [SLE].[Justification]
            WHERE  [JustificationID] = @JustificationID;
        -- End Return Select <- do not remove

        END;
    ELSE
        BEGIN
            SELECT @Message = 'InvalidNumberRange'
            RAISERROR(@Message, 16, 12);
        END;
