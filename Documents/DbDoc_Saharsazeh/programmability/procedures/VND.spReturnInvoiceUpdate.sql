CREATE      PROC [VND].[spReturnInvoiceUpdate]
    @ReturnInvoiceID INT ,
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
    @Version INT ,
    @PreVoucherID INT ,
    @Non_Received decimal(36,10),
    @BaseType TINYINT NULL

--WITH ENCRYPTION
AS
    SET NOCOUNT ON;


        
    DECLARE  @CompanyId INT;

    SELECT top 1 @CompanyId=CompanyID 
    FROM CFG.Branch 
    where BranchID=@BranchID


	EXEC CFG.CheckWithVatAndSeason @Date = @Date , -- date
	                               @FinancialPeriodId = @FinancialPeriodID, -- int
                                   @CompanyId=@CompanyId
        
        DECLARE @PreVersion INT ,
                @PrePrevoucherID INT;

        SELECT @PreVersion = [Version] ,
               @PrePrevoucherID = PreVoucherID
        FROM   [VND].[ReturnInvoice]
        WHERE  [ReturnInvoiceID] = @ReturnInvoiceID;

        IF @Version <> @PreVersion
           OR @PrePrevoucherID IS NOT NULL
            RAISERROR('Version mismatch...', 16, 10);

        SET @Non_Received = @TotalNetPrice;

        DECLARE @StartNum INT = NULL ,
                @EndNum INT = NULL ,
                @ResetBranch BIT = 0 ,
                @ResetType BIT = 0 ,
                @DocumentNumID INT ,
                @DocumentNumTypeID INT;

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
                                WHERE  ReturnInvoiceID <> @ReturnInvoiceID
                                       AND FinancialPeriodID = @FinancialPeriodID
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

                UPDATE [VND].[ReturnInvoice]
                SET    [DlID] = @DlID ,
                       [BranchID] = @BranchID ,
                       [Type] = @Type ,
                       [Number] = @Number ,
                       [Date] = @Date ,
                       [CurrencyID] = @CurrencyID ,
                       [CurrencyRate] = @CurrencyRate ,
                       [TotalPrice] = @TotalPrice ,
                       [TotalTax] = @TotalTax ,
                       [TotalDuty] = @TotalDuty ,
                       [TotalNetPrice] = @TotalNetPrice ,
                       [LastEditor] = @LastEditor ,
                       [LastEditionDate] = @LastEditionDate ,
                       [Version] = @Version + 1 ,
                       [Non_Received] = @Non_Received,
                       [BaseType]=@BaseType
                WHERE  [ReturnInvoiceID] = @ReturnInvoiceID;

                -- Begin Return Select <- do not remove
                SELECT [Version],
                       [Number]
                FROM   [VND].[ReturnInvoice]
                WHERE  [ReturnInvoiceID] = @ReturnInvoiceID;

            END;
        ELSE
            BEGIN
                RAISERROR('InvalidNumberRange', 16, 12);
            END;
