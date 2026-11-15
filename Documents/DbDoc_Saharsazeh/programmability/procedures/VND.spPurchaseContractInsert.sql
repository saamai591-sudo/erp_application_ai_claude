
CREATE   PROC [VND].spPurchaseContractInsert
    @BaseType TINYINT ,
    @DlID BIGINT ,
    @PurchaseOrderDlID BIGINT,
    @BranchID INT ,
    @FinancialPeriodID INT ,
    @Type TINYINT ,
    @InvoiceNumber NVARCHAR(100) ,
    @InvoiceDate DATE ,
    @Number INT ,
    @Date DATE ,
    @CurrencyID INT ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalTax DECIMAL(30, 4) ,
    @TotalDuty DECIMAL(30, 4) ,
    @TotalNetPrice DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
	@Status Tinyint
AS
    SET NOCOUNT ON; 
    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @ResetBranch BIT = 0 ,
        @ResetType BIT = 0 ,
        @DocumentNumID INT ,
        @DocumentNumTypeID INT ,
        @Message NVARCHAR(MAX);
			
			
    SELECT  @DocumentNumTypeID = DocumentNumTypeID
    FROM    [CFG].[DocumentNumType]
    WHERE   EngName = 'PurchaseContract';
			
    SELECT  @StartNum = StartNum ,
            @EndNum = EndNum ,
            @DocumentNumID = DocumentNumID
    FROM    CFG.DocumentNum
    WHERE   DocumentNumTypeID = @DocumentNumTypeID
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

	
    IF ( @Number = 0
         OR @Number IS NULL
       )
        BEGIN
            SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                                   FROM     [VND].[PurchaseContract]
                                   WHERE    FinancialPeriodID = @FinancialPeriodID
									AND (   @ResetType = 0   OR [Type] = @Type )
									AND (   @ResetBranch = 0 OR BranchID = @BranchID )
                                 ), @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS ( SELECT    1
                          FROM      [VND].[PurchaseContract]
                          WHERE     FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetType = 0   OR [Type] = @Type )
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
                                    AND Number = @Number ) )
                BEGIN	
                    RAISERROR('NumberIsDuplicate',16,12);
                    RETURN;
                END;
        END;
	
    IF ( @Number >= @StartNum
         AND ( @EndNum IS NULL
               OR @Number <= @EndNum
             )
       )
        BEGIN  
	
            INSERT  INTO [VND].[PurchaseContract]
                    ( [BaseType] ,
                      [DlID] ,
                      [PurchaseOrderDlID],
                      [BranchID] ,
                      [FinancialPeriodID] ,
                      [Type] ,
                      [InvoiceNumber] ,
                      [InvoiceDate] ,
                      [Number] ,
                      [Date] ,
                      [CurrencyID] ,
                      [TotalPrice] ,
                      [TotalDiscount] ,
                      [TotalTax] ,
                      [TotalDuty] ,
                      [TotalNetPrice] ,
                      [Creator] ,
                      [CreationDate] ,
                      [LastEditor] ,
                      [LastEditionDate] ,
                      [Version],
					  [Status]
                    )
                    SELECT  @BaseType ,
                            @DlID ,
                            @PurchaseOrderDlID,
                            @BranchID ,
                            @FinancialPeriodID ,
                            @Type ,
                            @InvoiceNumber ,
                            @InvoiceDate ,
                            @Number ,
                            @Date ,
                            @CurrencyID ,
                            @TotalPrice ,
                            @TotalDiscount ,
                            @TotalTax ,
                            @TotalDuty ,
                            @TotalNetPrice ,
                            @Creator ,
                            @CreationDate ,
                            @LastEditor ,
                            @LastEditionDate ,
                            0,
							@Status
	
	-- Begin Return Select <- do not remove
            SELECT  [PurchaseContractID] ,
                    [Version] ,
                      [Number]
            FROM    [VND].[PurchaseContract]
            WHERE   [PurchaseContractID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove

        END;
    ELSE
    BEGIN
        RAISERROR( 'InvalidNumberRange',16,12);
    END;

