
--==============================================ALTER SpProposalInsert

CREATE   PROC [VND].[SpProposalInsert]
    @PartyID BIGINT ,
    @BranchID INT ,
    @FinancialPeriodID INT ,
    @QuotationNumber nvarchar(100) = NULL ,
    @QuotationDate DATE = NULL ,
    @ExpireDate DATE = NULL ,
    @Number INT ,
    @Date DATE ,
    @CurrencyID INT ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalTax DECIMAL(30, 4) ,
    @TotalDuty DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @BaseDocument TINYINT ,
    @Status TINYINT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
    DECLARE @StartNum INT = NULL ,
            @EndNum INT = NULL ,
            @ResetType BIT = 0 ,
			@ResetBranch BIT = 0 ,
            @DocumentNumID INT ,
            @DocumentNumTypeID INT ,
            @Message NVARCHAR(MAX);

    SELECT @DocumentNumTypeID = DocumentNumTypeID
    FROM   [CFG].[DocumentNumType]
    WHERE  EngName = 'Proposal';

    SELECT @StartNum = StartNum ,
           @EndNum = EndNum ,
           @DocumentNumID = DocumentNumID
    FROM   CFG.DocumentNum
    WHERE  DocumentNumTypeID = @DocumentNumTypeID
           AND FinancialPeriodID = @FinancialPeriodID;


    IF EXISTS (   SELECT 1
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

    IF (   @Number = 0 OR @Number IS NULL )
        BEGIN
            SET @Number = ISNULL(
                          (   SELECT MAX(Number) + 1
                              FROM   [VND].[Proposal]
                              WHERE  FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
						  ) ,
                          @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS (   SELECT 1
                            FROM   [VND].[Proposal]
                            WHERE  FinancialPeriodID = @FinancialPeriodID
							   AND (   @ResetBranch = 0 OR BranchID = @BranchID )
                               AND Number = @Number 
						)
				)
                BEGIN
                    SELECT @Message = 'NumberIsDuplicate'
                    RAISERROR(@Message, 16, 12);
                    RETURN;
                END;
        END;

    IF (   @Number >= @StartNum
           AND (   @EndNum IS NULL
                   OR @Number <= @EndNum ))
		begin
			INSERT INTO [VND].[Proposal] ( [PartyID] ,
										   [BranchID] ,
										   [FinancialPeriodID] ,
										   [QuotationNumber] ,
										   [QuotationDate] ,
										   [ExpireDate] ,
										   [Number] ,
										   [Date] ,
										   [CurrencyID] ,
										   [TotalPrice] ,
										   [TotalDiscount] ,
										   [TotalTax] ,
										   [TotalDuty] ,
										   [Creator] ,
										   [CreationDate] ,
										   [LastEditor] ,
										   [LastEditionDate] ,
										   [Version] ,
										   [BaseDocument] ,
										   [Status] )
						SELECT @PartyID ,
							   @BranchID ,
							   @FinancialPeriodID ,
							   @QuotationNumber ,
							   @QuotationDate ,
							   @ExpireDate ,
							   @Number ,
							   @Date ,
							   @CurrencyID ,
							   @TotalPrice ,
							   @TotalDiscount ,
							   @TotalTax ,
							   @TotalDuty ,
							   @Creator ,
							   @CreationDate ,
							   @Creator ,
							   @CreationDate ,
							   0 ,
							   @BaseDocument ,
							   @Status;

    -- Begin Return Select <- do not remove
    SELECT [ProposalID] ,
           [Version] ,
            [Number]
    FROM   [VND].[Proposal]
    WHERE  [ProposalID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
    END
