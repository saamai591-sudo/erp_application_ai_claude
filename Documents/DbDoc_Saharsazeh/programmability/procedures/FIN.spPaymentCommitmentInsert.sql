
-------------------------------------
CREATE   PROC [FIN].[spPaymentCommitmentInsert] @FinancialPeriodID INT,
@BranchID INT,
@Number INT,
@Date DATE,
@PartyID BIGINT,
@Description NVARCHAR(250),
@Description2 NVARCHAR(250),
@PreVoucherID INT,
@Status TINYINT,
@BaseType TINYINT,
@ContractID INT,
@TenderID INT,
@PaymentRequestID INT,
@Creator INT,
@CreationDate DATETIME,
@LastEditor INT,
@LastEditionDate DATETIME
--WITH ENCRYPTION
AS
        SET NOCOUNT ON

        IF NOT EXISTS (SELECT
                                *
                        FROM CFG.DocumentNum d
                        WHERE d.DocumentNumTypeID = (SELECT
                                        DocumentNumTypeID
                                FROM CFG.DocumentNumType
                                WHERE EngName = 'PaymentCommitment')
                        AND d.FinancialPeriodID = @FinancialPeriodID)
        BEGIN
                RAISERROR ('در دوره مالی جاری، شماره گذاری پرداخت تضمینی انجام نشده است.', 16, 12)
                RETURN
        END

        DECLARE @StartNum INT = NULL
               ,@EndNum INT = NULL
               ,@Branch BIT = 0
               ,@ResetType BIT = 0
               ,@DocumentNumID INT

        SELECT
                @StartNum = StartNum
               ,@EndNum = EndNum
               ,@DocumentNumID = DocumentNumID
        FROM cfg.DocumentNum
        WHERE DocumentNumTypeID = (SELECT
                        DocumentNumTypeID
                FROM CFG.DocumentNumType
                WHERE EngName = 'PaymentCommitment')
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
                                FROM FIN.PaymentCommitment p
                                WHERE p.FinancialPeriodID = @FinancialPeriodID
                                AND p.Number = @Number
                                AND (@Branch = 0
                                OR p.BranchID = @BranchID))
                BEGIN
                        RAISERROR ('شماره تکراری است.', 16, 12)
                        RETURN
                END
        END

        IF (@Number = 0
                OR @Number IS NULL)
                SET @Number = ISNULL((SELECT
                                MAX(Number) + 1
                        FROM [FIN].[PaymentCommitment]
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

                INSERT INTO [FIN].[PaymentCommitment] ([FinancialPeriodID], [BranchID], [Number], [Date], [PartyID], [Description], [Description2], [PreVoucherID], [Status], [BaseType], [ContractID], [TenderID], [PaymentRequestID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
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
                               ,@BaseType
                               ,@ContractID
                               ,@TenderID
                               ,@PaymentRequestID
                               ,0
                               ,@Creator
                               ,@CreationDate
                               ,@LastEditor
                               ,@LastEditionDate

                -- Begin Return Select <- do not remove
                SELECT
                        [PaymentCommitmentID]
                       ,[Version]
                       ,[Number]
                FROM [FIN].[PaymentCommitment]
                WHERE [PaymentCommitmentID] = SCOPE_IDENTITY()
        -- End Return Select <- do not remove

        END
        ELSE
        BEGIN
                DECLARE @Message NVARCHAR(MAX)
                SELECT
                        @Message = 'InvalidNumberRange'
                RAISERROR (@Message, 16, 12)
        END;
