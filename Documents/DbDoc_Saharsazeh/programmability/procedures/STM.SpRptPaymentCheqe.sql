
-----------------------------------------------------------------------------------------------------------------
CREATE    proc [STM].SpRptPaymentCheqe

@PaymentReceiptID nvarchar(max)

--WITH ENCRYPTION
AS

declare @Culture NVARCHAR(5),
			    @CultureNo tinyint

		SET @Culture = cfg.GetuserCulture()	

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = @Culture


CREATE TABLE #Ids
(id INT)

insert into #Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@PaymentReceiptID)
----------------------
select 
B.Amount PaymentCheqeAmount,
CFG.GetSaturnDate(B.Date,0) [PaymentCheqeDate]
,B.Number PaymentCheqeNumber,
B.RowIndex PaymentCheqeRowIndex,
case when @CultureNo = 1 then  b.Description else   b.Description2 end Description,
case when @CultureNo = 1 then  d.Title else   d.Title2 end  Title,
b.PaymentReceiptID,
case when @CultureNo = 1 then  bt.Title else   bt.Title2 end BankAccountType,
c.AccountNo,
bb.Title BankBranch,
bb.Code BankBranchCode,
Bank.Title Bank

FROM FIN.PaymentReceipt A
join FIN.PaymentCheqe B on B.PaymentReceiptID=A.PaymentReceiptID
join CFG.BankAccount c on c.BankAccountID=b.BankAccountID
JOIN cfg.BankAccountType bt ON bt.BankAccountTypeID=c.BankAccountTypeID
join ACC.DL d on d.DLID=c.DlID
join cfg.BankBranch bb on bb.BankBranchID = c.BankBranchID
join cfg.Bank on Bank.BankID = bb.BankID
where  a.PaymentReceiptID in (select id from #Ids)
