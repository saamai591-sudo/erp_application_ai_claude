------------------------------------- 
CREATE   PROC [FIN].[spReceiveCommitmentInsert] @FinancialPeriodID INT,
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
                                WHERE r.FinancialPeriodID = @FinancialPeriodID
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
                INSERT INTO [FIN].[ReceiveCommitment] ([FinancialPeriodID], [BranchID], [Number], [Date], [PartyID], [Description], [Description2], [PreVoucherID], [Status], [CashID], [BaseType], [ContractID], [TenderParticipateID], [PurchaseContractID], [TenderID], [ReceiveRequestID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
                        SELECT
                                @FinancialPeriodID
                               ,@BranchID
                               ,@Number
                               ,@Date
                               ,@PartyID
                               ,@Description
                               ,@Description2
                               ,@PreVoucherID
                               ,@Status
                               ,@CashID
                               ,@BaseType
                               ,@ContractID
                               ,@TenderParticipateID
                               ,@PurchaseContractID
                               ,@TenderID
                               ,@ReceiveRequestID
                               ,0
                               ,@Creator
                               ,@CreationDate
                               ,@LastEditor
                               ,@LastEditionDate

                -- Begin Return Select <- do not remove
                SELECT
                        [ReceiveCommitmentID]
                       ,[Version]
                       ,[Number]
                FROM [FIN].[ReceiveCommitment]
                WHERE [ReceiveCommitmentID] = SCOPE_IDENTITY()
        -- End Return Select <- do not remove
        END
        ELSE
        BEGIN
                SELECT
                        @Message = 'InvalidNumberRange'
                RAISERROR (@Message, 16, 12)
        END;
