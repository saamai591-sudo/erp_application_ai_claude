CREATE       PROC [NOC].[spModifiedTopicUpdate]
(
 @ModifiedTopicID int
,@ModificationID int
,@SlID int
,@ModificationPercent  decimal(5,2)
,@BaseCurrencyDebitAccrue decimal(30,4)
,@BaseCurrencyCreditAccrue decimal(30,4)
,@ReportCurrencyDebitAccrue decimal(30,4)
,@ReportCurrencyCreditAccrue decimal(30,4)
,@BaseCurrencyDebitCash decimal(30,4)
,@BaseCurrencyCreditCash decimal(30,4)
,@ReportCurrencyDebitCash decimal(30,4)
,@ReportCurrencyCreditCash decimal(30,4)
,@ReportCurrencyDebitExchange decimal(30,4)
,@ReportCurrencyCreditExchange  decimal(30,4)
,@Version int
,@LastEditor int
,@LastEditionDate datetime
,@ToBeReported bit
)
--WITH ENCRYPTION 
AS

IF @Version <> (
       SELECT [Version]
       FROM   [NOC].[ModifiedTopic]
       WHERE   [ModifiedTopicID] = @ModifiedTopicID
   )
BEGIN
    RAISERROR('Version mismatch...', 16, 10)
    RETURN
END

UPDATE [NOC].[ModifiedTopic]
   SET [ModificationID] = @ModificationID
      ,[SlID] = @SlID
	  ,[ModificationPercent] = @ModificationPercent
      ,[BaseCurrencyDebitAccrue] = @BaseCurrencyDebitAccrue
      ,[BaseCurrencyCreditAccrue] = @BaseCurrencyCreditAccrue
      ,[ReportCurrencyDebitAccrue] = @ReportCurrencyDebitAccrue
      ,[ReportCurrencyCreditAccrue] = @ReportCurrencyCreditAccrue
      ,[BaseCurrencyDebitCash] = @BaseCurrencyDebitCash
      ,[BaseCurrencyCreditCash] = @BaseCurrencyCreditCash
      ,[ReportCurrencyDebitCash] = @ReportCurrencyDebitCash
      ,[ReportCurrencyCreditCash] = @ReportCurrencyCreditCash
	  ,[ReportCurrencyDebitExchange] = @ReportCurrencyDebitExchange
	  ,[ReportCurrencyCreditExchange] = @ReportCurrencyCreditExchange
      ,[Version] = @Version + 1
      ,[LastEditor] = @LastEditor
      ,[LastEditionDate] = @LastEditionDate
	  ,ToBeReported = @ToBeReported
 WHERE  [ModifiedTopicID] = @ModifiedTopicID


select [Version]
from [NOC].[ModifiedTopic] 
where ModifiedTopicID = @ModifiedTopicID;
