CREATE     PROC [NOC].[spCurrencyExchangeUpdate]
    @CurrencyExchangeID int,
    @AnalysingID int,
    @RowIndex int,
    @CashAnalysingID int,
    @BaseDocumentType varchar(100),
    @BaseDocumentID int,
    @SlID int,
    @PartyID bigint,
    @ExchangeGainLoss int,
    @Value decimal(30, 4),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

    if @Version=(Select [Version] from NOC.CurrencyExchange
    where CurrencyExchangeID = @CurrencyExchangeID)
    begin

        set @Version = @Version +1 

        UPDATE NOC.CurrencyExchange
        SET    AnalysingID = @AnalysingID, 
               RowIndex = @RowIndex, 
               --CashAnalysingID = @CashAnalysingID,
               --BaseDocumentType = @BaseDocumentType,
               --BaseDocumentID = @BaseDocumentID,
               SlID = @SlID,
               PartyID = @PartyID,
               ExchangeGainLoss = @ExchangeGainLoss,
               Value = @Value,
               LastEditor = @LastEditor, 
               LastEditionDate = @LastEditionDate, 
               [Version] = @Version
        WHERE  CurrencyExchangeID = @CurrencyExchangeID

        -- Begin Return Select <- do not remove
        SELECT [Version]
        FROM   NOC.CurrencyExchange
        WHERE  CurrencyExchangeID = @CurrencyExchangeID
        -- End Return Select <- do not remove

    end
    else 
        RAISERROR('Version mismatch...', 16 , 10)
