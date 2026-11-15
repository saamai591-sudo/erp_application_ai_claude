create   view NOC.VWConfirmStatementItemPortion

as

select d.ConfirmStatementPrePaymentID,
	   b.SlID,
	   b.Share,
	   c.SlID AdditionDeductionSlID
from cnt.ConfirmStatementItem a
join NOC.VWConfirmStatementPortion b
	on a.ConfirmStatementID = b.ConfirmStatementID
join cnt.AdditionDeductionTypeMethod c
	on a.AdditionDeductionTypeMethodID = c.AdditionDeductionTypeMethodID
join cnt.ConfirmStatementPrePayment d
	on d.ConfirmStatementItemID = a.ConfirmStatementItemID