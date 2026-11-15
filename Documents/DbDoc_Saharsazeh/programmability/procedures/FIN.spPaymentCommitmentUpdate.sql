
-------------------------------------
CREATE   PROC [FIN].[spPaymentCommitmentUpdate] @PaymentCommitmentID INT,
@FinancialPeriodID INT,
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
@Version INT,
@Creator INT,
@CreationDate DATETIME,
@LastEditor INT,
@LastEditionDate DATETIME
--WITH ENCRYPTION
AS
        SET NOCOUNT ON

        DECLARE @prePrevoucherID INT
               ,@PreVersion INT

        SELECT
                @PreVersion = [Version]
               ,@prePrevoucherID = PreVoucherID
        FROM [FIN].[PaymentCommitment]
        WHERE [PaymentCommitmentID] = @PaymentCommitmentID

        IF @Version <> @PreVersion
                OR @prePrevoucherID IS NOT NULL
                RAISERROR ('Version mismatch...', 16, 10)

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
                                WHERE p.PaymentCommitmentID <> @PaymentCommitmentID
                                AND p.FinancialPeriodID = @FinancialPeriodID
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

                UPDATE [FIN].[PaymentCommitment]
                SET [BranchID] = @BranchID
                   ,[Number] = @Number
                   ,[Date] = @Date
                   ,[PartyID] = @PartyID
                   ,[Description] = @Description
                   ,[Description2] = @Description2
                   ,[Status] = @Status
                   ,[BaseType] = @BaseType
                   ,[ContractID] = @ContractID
                   ,[TenderID] = @TenderID
                   ,[PaymentRequestID] = @PaymentRequestID
                   ,[Version] = @Version + 1
                   ,[LastEditor] = @LastEditor
                   ,[LastEditionDate] = @LastEditionDate
                WHERE [PaymentCommitmentID] = @PaymentCommitmentID

                -- Begin Return Select <- do not remove
                SELECT
                        [Version]
                       ,[Number]
                FROM [FIN].[PaymentCommitment]
                WHERE [PaymentCommitmentID] = @PaymentCommitmentID
        -- End Return Select <- do not remove
        END
        ELSE
        BEGIN
                DECLARE @Message NVARCHAR(MAX) = 'InvalidNumberRange'
                RAISERROR (@Message, 16, 12)
        END;

