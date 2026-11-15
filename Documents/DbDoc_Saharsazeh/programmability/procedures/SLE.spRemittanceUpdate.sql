CREATE      PROC [SLE].[spRemittanceUpdate]
    @RemittanceID INT ,
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @StockID INT ,
    @CustomerID BIGINT ,
    @AddressID INT ,
    @Number INT ,
    @Date DATETIME ,
    @DeadLine DATETIME ,
    @Status TINYINT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@SaleAreaID int
--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 

	if @SaleAreaID is null
	set @SaleAreaID = -1

    IF @Version <> ( SELECT [Version]
                     FROM   [SLE].[Remittance]
                     WHERE  [RemittanceID] = @RemittanceID
                   )
        RAISERROR('Version mismatch...', 16 , 10);
	
    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Branch BIT = 0 ,
        @ResetType BIT = 0 ,
        @DocumentNumID INT ,
        @Message NVARCHAR(MAX),
			@ResetSaleArea bit = 0
			
    SELECT  @StartNum = StartNum ,
            @EndNum = EndNum ,
            @DocumentNumID = DocumentNumID
    FROM    CFG.DocumentNum
    WHERE   DocumentNumTypeID = 14
            AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS ( SELECT  *
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 5 )
        BEGIN
            SET @Branch = 1;
        END;
	
    IF EXISTS ( SELECT  *
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
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     [SLE].[Remittance]
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                                        AND ( @Branch = 0
                                              OR BranchID = @BranchID
                                            )
                                        AND ( @ResetType = 0
                                              OR [SaleTypeID] = @SaleTypeId
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

            UPDATE  [SLE].[Remittance]
            SET     [BaseDocument] = @BaseDocument ,
                    [SaleTypeID] = @SaleTypeId ,
                    [BranchID] = @BranchID ,
                    [StockID] = @StockID ,
                    [CustomerID] = @CustomerID ,
                    [AddressID] = @AddressID ,
                    [Number] = @Number ,
                    [Date] = @Date ,
                    [DeadLine] = @DeadLine ,
                    [Status] = @Status ,
                    [Version] = @Version + 1 ,
                    [LastEditor] = @LastEditor ,
                    [LastEditionDate] = @LastEditionDate,
					[SaleAreaID] = @SaleAreaID
            WHERE   [RemittanceID] = @RemittanceID;
	
		-- Begin Return Select <- do not remove
            SELECT  [Version]  ,
                    [Number]
            FROM    [SLE].[Remittance]
            WHERE   [RemittanceID] = @RemittanceID;	
		-- End Return Select <- do not remove
        END;
    ELSE
        BEGIN						
            RAISERROR('InvalidNumberRange',16,12);
        END;
