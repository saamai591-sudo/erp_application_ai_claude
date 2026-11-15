CREATE PROC [FIN].[spReceiveCheqeCommitmentInsert]
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
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Date DATETIME
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

INSERT INTO [FIN].[ReceiveCheqeCommitment]
(
    [ReceiveCommitmentID],
    [RowIndex],
    [Number],
    [CurrencyID],
    [CurrencyRate],
    [Amount],
    [BankID],
    [BankBranchCode],
    [BankBranchName],
    [AccountNumber],
    [Description],
    [Description2],
    [LastState],
    [CommitmentTypeID],
    [Date],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate]
)
SELECT @ReceiveCommitmentID,
       @RowIndex,
       @Number,
       @CurrencyID,
       @CurrencyRate,
       @Amount,
       @BankID,
       @BankBranchCode,
       @BankBranchName,
       @AccountNumber,
       @Description,
       @Description2,
       @LastState,
       @CommitmentTypeID,
       @Date,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate;

-- Begin Return Select <- do not remove
SELECT  [ReceiveCheqeCommitmentID],
        [Version]
FROM [FIN].[ReceiveCheqeCommitment]
WHERE [ReceiveCheqeCommitmentID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove


DECLARE @ReceiveRequestID INT = NULL;
SELECT @ReceiveRequestID = r.ReceiveRequestID
FROM FIN.ReceiveCommitment r
WHERE r.ReceiveCommitmentID = @ReceiveCommitmentID;

IF (@ReceiveRequestID IS NOT NULL)
BEGIN
    UPDATE REQ.ReceiveRequest
    SET Non_Received = Non_Received - @Amount
    WHERE ReceiveRequestID = @ReceiveRequestID;
END;
