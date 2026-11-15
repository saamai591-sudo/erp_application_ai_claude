------------------------------------- 
CREATE   PROC [FIN].[spReceiveCommitmentUpdate] @ReceiveCommitmentID INT,
@FinancialPeriodID INT,
@BranchID INT,
@Number INT,
@Date DATE,
@PartyID BIGINT,
@Description NVARCHAR(250),
@Description2 NVARCHAR(250),
@PreVoucherID INT,
@Status TINYINT,
@CashID INT,
@ContractID INT,
@TenderID INT,
@ReceiveRequestID INT,
@Version INT,
@Creator INT,
@CreationDate DATETIME,
@LastEditor INT,
@LastEditionDate DATETIME,
@BaseType TINYINT,
@TenderParticipateID INT,
@PurchaseContractID INT
--WITH ENCRYPTION
AS
        SET NOCOUNT ON

        DECLARE @prePrevoucherID INT
               ,@PreVersion INT

        SELECT
                @PreVersion = [Version]
               ,@prePrevoucherID = PreVoucherID
        FROM [FIN].[ReceiveCommitment]
        WHERE [ReceiveCommitmentID] = @ReceiveCommitmentID


        IF @Version <> @PreVersion
                OR @prePrevoucherID IS NOT NULL
                RAISERROR ('Version mismatch...', 16, 10)

        IF NOT EXISTS (SELECT
                                *
                        FROM CFG.DocumentNum d
                        WHERE d.DocumentNumTypeID = (SELECT
                                        DocumentNumTypeID
                                FROM CFG.DocumentNumType
                                WHERE EngName = 'ReceiveCommitment')
                        AND d.FinancialPeriodID = @FinancialPeriodID)
        BEGIN
                RAISERROR ('در دوره مالی جاری، شماره گذاری دریافت تضمینی انجام نشده است.', 16, 12)
                RETURN
        END

        DECLARE @StartNum INT = NULL
               ,@EndNum INT = NULL
               ,@Branch BIT = 0
               ,@ResetType BIT = 0
               ,@DocumentNumID INT
               ,@Message NVARCHAR(MAX)


        SELECT
                @StartNum = StartNum
               ,@EndNum = EndNum
               ,@DocumentNumID = DocumentNumID
        FROM CFG.DocumentNum
        WHERE DocumentNumTypeID = (SELECT
                        DocumentNumTypeID
                FROM CFG.DocumentNumType
                WHERE EngName = 'ReceiveCommitment')
        AND FinancialPeriodID = @FinancialPeriodID

        IF EXISTS (SELECT
                                *
                        FROM cfg.DocumentNumResetNumberBase
                        WHERE DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 7)
        BEGIN
                SET @Branch = 1
        END

        IF EXISTS (SELECT
                                *
                        FROM cfg.DocumentNumResetNumberBase
                        WHERE DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 6)
        BEGIN
                SET @ResetType = 1
        END

        IF (@Number IS NOT NULL
                AND @Number <> 0)
        BEGIN
                IF EXISTS (SELECT
                                        *
                                FROM FIN.ReceiveCommitment r
                                WHERE r.ReceiveCommitmentID <> @ReceiveCommitmentID
                                AND r.FinancialPeriodID = @FinancialPeriodID
                                AND r.Number = @Number
                                AND (@Branch = 0
                                OR r.BranchID = @BranchID))
                BEGIN
                        RAISERROR ('شماره تکراری است.', 16, 12)
                        RETURN
                END
        END

        IF (@Number = 0
                OR @Number IS NULL)
                SET @Number = ISNULL((SELECT
                                MAX(Number) + 1
                        FROM [FIN].[ReceiveCommitment]
                        WHERE FinancialPeriodID = @FinancialPeriodID
                        AND (@Branch = 0
                        OR BranchID = @BranchID))
                , @StartNum)

        IF (
                @Number >= @StartNum
                AND (@EndNum IS NULL
                OR @Number <= @EndNum)
                )
        BEGIN
                UPDATE [FIN].[ReceiveCommitment]
                SET [BranchID] = @BranchID
                   ,[Number] = @Number
                   ,[Date] = @Date
                   ,[PartyID] = @PartyID
                   ,[Description] = @Description
                   ,[Description2] = @Description2
                   ,[Status] = @Status
                   ,[CashID] = @CashID
                   ,[BaseType] = @BaseType
                   ,[ContractID] = @ContractID
                   ,[TenderParticipateID] = @TenderParticipateID
                   ,[PurchaseContractID] = @PurchaseContractID
                   ,[TenderID] = @TenderID
                   ,[ReceiveRequestID] = @ReceiveRequestID
                   ,[Version] = @Version + 1
                   ,[LastEditor] = @LastEditor
                   ,[LastEditionDate] = @LastEditionDate
                WHERE [ReceiveCommitmentID] = @ReceiveCommitmentID

                -- Begin Return Select <- do not remove
                SELECT
                        [Version]
                       ,[Number]
                FROM [FIN].[ReceiveCommitment]
                WHERE [ReceiveCommitmentID] = @ReceiveCommitmentID
        -- End Return Select <- do not remove
        END
        ELSE
        BEGIN
                SELECT
                        @Message = 'InvalidNumberRange'
                RAISERROR (@Message, 16, 12)
        --RAISERROR('شماره در محدوده ي مجاز نمي باشد', 16, 12)
        END
