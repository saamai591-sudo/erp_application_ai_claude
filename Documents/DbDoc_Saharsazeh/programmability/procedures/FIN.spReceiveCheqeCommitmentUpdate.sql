CREATE PROC [FIN].[spReceiveCheqeCommitmentUpdate]
    @ReceiveCheqeCommitmentID INT,
    @ReceiveCommitmentID INT,
    @RowIndex SMALLINT,
    @Number NVARCHAR(100),
    @CurrencyID INT,
    @CurrencyRate DECIMAL(20, 10),
    @Amount DECIMAL(30, 4),
    @BankID INT,
    @BankBranchCode NVARCHAR(100),
    @BankBranchName NVARCHAR(250),
    @AccountNumber NVARCHAR(100),
    @Description NVARCHAR(250),
    @Description2 NVARCHAR(250),
    @LastState TINYINT,
    @CommitmentTypeID INT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Date DATETIME
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

DECLARE @prePrevoucherID INT;

SELECT @prePrevoucherID = PreVoucherID
FROM fin.ReceiveCommitment pr
WHERE pr.ReceiveCommitmentID = @ReceiveCommitmentID;


IF @Version <>
(
    SELECT [Version]
    FROM [FIN].[ReceiveCheqeCommitment]
    WHERE [ReceiveCheqeCommitmentID] = @ReceiveCheqeCommitmentID
)
   OR @prePrevoucherID IS NOT NULL
    RAISERROR('Version mismatch...', 16, 10);


DECLARE @PreAmount DECIMAL(30, 4);
SELECT @PreAmount = r.Amount
FROM FIN.ReceiveCheqeCommitment r
WHERE r.ReceiveCheqeCommitmentID = @ReceiveCheqeCommitmentID;


UPDATE [FIN].[ReceiveCheqeCommitment]
SET [RowIndex] = @RowIndex,
    [Number] = @Number,
    [CurrencyID] = @CurrencyID,
    [CurrencyRate] = @CurrencyRate,
    [Amount] = @Amount,
    [BankID] = @BankID,
    [BankBranchCode] = @BankBranchCode,
    [BankBranchName] = @BankBranchName,
    [AccountNumber] = @AccountNumber,
    [Description] = @Description,
    [Description2] = @Description2,
    [LastState] = @LastState,
    [CommitmentTypeID] = @CommitmentTypeID,
    [Date] = @Date,
    [Version] = @Version + 1,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate
WHERE [ReceiveCheqeCommitmentID] = @ReceiveCheqeCommitmentID;
DECLARE @ReceiveRequestID INT = NULL;

SELECT @ReceiveRequestID = r.ReceiveRequestID
FROM FIN.ReceiveCommitment r
WHERE r.ReceiveCommitmentID = @ReceiveCommitmentID;

IF (@ReceiveRequestID IS NOT NULL)
BEGIN
    UPDATE REQ.ReceiveRequest
    SET Non_Received = (Non_Received + @PreAmount) - @Amount
    WHERE ReceiveRequestID = @ReceiveRequestID;
END;

-- Begin Return Select <- do not remove
SELECT [Version]
FROM [FIN].[ReceiveCheqeCommitment]
WHERE [ReceiveCheqeCommitmentID] = @ReceiveCheqeCommitmentID;
-- End Return Select <- do not remove
