CREATE VIEW [CFG].[BankAccount_LastAmount]
AS 

 select BankAccountID , 
		sum(Amount) LastAmount 
		
 from [FIN].[vwbankaccount]
 group by BankAccountID
