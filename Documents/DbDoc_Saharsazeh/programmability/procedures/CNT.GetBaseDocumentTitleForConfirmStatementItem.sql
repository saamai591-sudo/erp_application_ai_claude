create   proc [CNT].[GetBaseDocumentTitleForConfirmStatementItem]
@ConfirmStatementId int
as


DECLARE @Culture       VARCHAR(10),
		@CultureNo	   VARCHAR(10)
SET @Culture = CFG.GetuserCulture()

select @CultureNo = CultureNo
from cfg.CultureInfo
where Culture = @Culture


select ConfirmStatementItemID [Value],
	   case when a.BaseDocumentType = 2 then case when @CultureNo = 1 then b.Description else b.Description2 end 
			when a.BaseDocumentType = 3 then case when @CultureNo = 1 then c.Description else c.Description2 end 
			end Value1
from cnt.ConfirmStatementItem a
left join cnt.ContractStatementItem b on a.BaseDocumentType = 2 and a.BaseDocumentID = b.ContractStatementItemID
left join cnt.ContractStatementDetail c on a.BaseDocumentType = 3 and a.BaseDocumentID = c.ContractStatementDetailID
where ConfirmStatementID = @ConfirmStatementId