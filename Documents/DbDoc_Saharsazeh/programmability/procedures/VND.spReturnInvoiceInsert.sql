CREATE      PROC [VND].[spReturnInvoiceInsert]
    @DlID BIGINT ,
    @BranchID INT ,
    @FinancialPeriodID INT ,
    @Type TINYINT ,
    @Number INT ,
    @Date DATE ,
    @CurrencyID INT ,
    @CurrencyRate DECIMAL(20, 4) ,
    @TotalPrice decimal(36,10) ,
    @TotalTax decimal(36,10) ,
    @TotalDuty decimal(36,10) ,
    @TotalNetPrice decimal(36,10) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @PreVoucherID INT ,
    @Non_Received decimal(36,10),
    @BaseType TINYINT NULL

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @StartNum INT = NULL ,
            @EndNum INT = NULL ,
            @ResetBranch BIT = 0 ,
            @ResetType BIT = 0 ,
            @DocumentNumID INT ,
            @DocumentNumTypeID INT ,
            @Message NVARCHAR(MAX),
            @CompanyId INT;

    SELECT top 1 @CompanyId=CompanyID 
    FROM CFG.Branch 
    where BranchID=@BranchID


	EXEC CFG.CheckWithVatAndSeason @Date = @Date , 
	                               @FinancialPeriodId = @FinancialPeriodID, 
                                   @CompanyId=@CompanyId
	
    SET @Non_Received = @TotalNetPrice;

    SELECT @DocumentNumTypeID = DocumentNumTypeID
    FROM   [CFG].[DocumentNumType]
    WHERE  EngName = 'ReturnInvoice';

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
                              FROM   [VND].[ReturnInvoice]
                              WHERE  FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetType = 0   OR [Type] = @Type )
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
							) ,
                          @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS (   SELECT 1
                            FROM   [VND].[ReturnInvoice]
                            WHERE  FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetType = 0   OR [Type] = @Type )
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
                                   AND Number = @Number ))
                BEGIN
                    RAISERROR('NumberIsDuplicate', 16, 12);
                    RETURN;
                END;
        END;

    IF (   @Number >= @StartNum
           AND (   @EndNum IS NULL
                   OR @Number <= @EndNum ))
    BEGIN

            INSERT INTO [VND].[ReturnInvoice]
            (  [DlID] ,
                [BranchID] ,
                [FinancialPeriodID] ,
                [Type] ,
                [Number] ,
                [Date] ,
                [CurrencyID] ,
                [CurrencyRate] ,
                [TotalPrice] ,
                [TotalTax] ,
                [TotalDuty] ,
                [TotalNetPrice] ,
                [Creator] ,
                [CreationDate] ,
                [LastEditor] ,
                [LastEditionDate] ,
                [Version] ,
                [PreVoucherID] ,
                [Non_Received],
                [BaseType])
            SELECT @DlID ,
                    @BranchID ,
                    @FinancialPeriodID ,
                    @Type ,
                    @Number ,
                    @Date ,
                    @CurrencyID ,
                    @CurrencyRate ,
                    @TotalPrice ,
                    @TotalTax ,
                    @TotalDuty ,
                    @TotalNetPrice ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate ,
                    0 ,
                    @PreVoucherID ,
                    @Non_Received,
                    @BaseType;

        -- Begin Return Select <- do not remove
        SELECT [ReturnInvoiceID] ,
                [Version] ,
                [Number]
        FROM   [VND].[ReturnInvoice]
        WHERE  [ReturnInvoiceID] = SCOPE_IDENTITY();
        -- End Return Select <- do not remove
    END;
    ELSE BEGIN
            RAISERROR('InvalidNumberRange', 16, 12);
    END;
