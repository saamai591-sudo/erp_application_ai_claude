
------------------------------------ START RAHA ABBASSI SCRIPTS
CREATE   FUNCTION [NOC].FnAdvanceDepreciation ()
RETURNS  @T table(  CalculationResultID int,
					StartDate Date,
					EndDate Date,
					Value decimal(30,4),
					VoucherID int,
					ReferenceNumber int,
					VoucherDate Date,
					DlID int,
					ParameterID int,
					CalculationPersonelID int,
					PersonelID int)
AS
begin

	insert into @T
	select 
		a.CalculationResultID,
		c.StartDate,
		c.EndDate,
		a.Value,
		b.VoucherID,
		v.ReferenceNumber,
		v.Date VoucherDate,
		f.DlID,
		a.ParameterID,
		a.CalculationPersonelID,
		b.PersonelID
	from pay.CalculationResult a
	join pay.Parameter p
		on p.ParameterID = a.ParameterID
	join pay.CalculationPersonel b
		on a.CalculationPersonelID = b.CalculationPersonelID 
	join hrm.CalendarMonth c
		on b.CalendarMonthID = c.CalendarMonthID
	join hrm.Personel e
		on e.PersonelID = b.PersonelID
	join cfg.Party f
		on f.PartyID = e.PartyID
	join acc.Voucher v
		on v.VoucherID = b.VoucherID
	where
	( p.CategoryID = 7   
	or 
	  p.ParameterID in (select ParameterID from NOC.FractionPayrollParameterSetting where type = 1)
	)
	and ParameterValueTypeID = 7
	and c.StartDate >= (select top 1 StartDate from noc.ReportagePeriod order by StartDate)
	and a.Value > 0
RETURN
end
