CREATE   PROC [SLE].[spSaleContractInsert]
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeID INT = NULL ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @Number INT ,
    @Date DATE ,
    @ContractNumber NVARCHAR(250) = NULL ,
    @ContractDate DATE = NULL ,
    @CurrencyID INT ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalNetPrice DECIMAL(30, 4) ,
    @TotalTax DECIMAL(30, 4) ,
    @TotalDuty DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@SaleAreaId int,
	@Status Tinyint
AS
    SET NOCOUNT ON; 

	if @SaleAreaID is null
	set @SaleAreaID = -1

    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Branch BIT = 0 ,
        @ResetType BIT = 0 ,
        @DocumentNumID INT ,
        @Message NVARCHAR(MAX),
			@ResetSaleArea bit = 0
			
    SELECT  @StartNum = dn.StartNum ,
            @EndNum = dn.EndNum ,
            @DocumentNumID = dn.DocumentNumID
    FROM    CFG.DocumentNum AS dn
            JOIN CFG.DocumentNumType AS dnt ON dnt.DocumentNumTypeID = dn.DocumentNumTypeID
    WHERE   dnt.EngName = 'SaleContract'
            AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS ( SELECT  1
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 5 )
        BEGIN
            SET @Branch = 1;
        END;
	
    IF EXISTS ( SELECT  1
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
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
	
    IF ( @Number = 0
         OR @Number IS NULL
       )
        SET @Number = ISNULL(( SELECT   MAX(sc.Number) + 1
                               FROM     [SLE].[SaleContract] AS [sc]
                               WHERE    sc.FinancialPeriodID = @FinancialPeriodID
                                        AND ( @Branch = 0
                                              OR sc.BranchID = @BranchID
                                            )
                                        AND ( @ResetType = 0
                                              OR [sc].[SaleTypeID] = @SaleTypeID
                                            )
                            AND
                            (
                                @ResetSaleArea = 0
                                OR [SaleAreaID] = @SaleAreaId
                            )
                             ), @StartNum);
	
    IF ( @Number >= @StartNum
         AND ( @EndNum IS NULL
               OR @Number <= @EndNum
             )
       )
        BEGIN
            INSERT  INTO [SLE].[SaleContract]
                    ( [FinancialPeriodID] ,
                      [BaseDocument] ,
                      [SaleTypeID] ,
                      [BranchID] ,
                      [CustomerID] ,
                      [Number] ,
                      [Date] ,
                      [ContractNumber] ,
                      [ContractDate] ,
                      [CurrencyID] ,
                      [TotalPrice] ,
                      [TotalDiscount] ,
                      [TotalNetPrice] ,
                      [TotalTax] ,
                      [TotalDuty] ,
                      [Version] ,
                      [Creator] ,
                      [CreationDate] ,
                      [LastEditor] ,
                      [LastEditionDate],
					  [SaleAreaId],
					  [Status]
                    )
                    SELECT  @FinancialPeriodID ,
                            @BaseDocument ,
                            @SaleTypeID ,
                            @BranchID ,
                            @CustomerID ,
                            @Number ,
                            @Date ,
                            @ContractNumber ,
                            @ContractDate ,
                            @CurrencyID ,
                            @TotalPrice ,
                            @TotalDiscount ,
                            @TotalNetPrice ,
                            @TotalTax ,
                            @TotalDuty ,
                            0 ,
                            @Creator ,
                            @CreationDate ,
                            @LastEditor ,
                            @LastEditionDate,
							@SaleAreaId,
							@Status;
	
	-- Begin Return Select <- do not remove
            SELECT  [SaleContractID] ,
                    [Version], 
                    [Number] 
            FROM    [SLE].[SaleContract]
            WHERE   [SaleContractID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
        END;
    ELSE
        BEGIN
            RAISERROR('InvalidNumberRange',16,12);
        END;
