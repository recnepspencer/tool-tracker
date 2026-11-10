"""The categories and tool models a new electrical contractor starts with.

Picked for a commercial electrical shop of roughly $10M a year: the shared, tracked
equipment that moves between jobs, not hand tools each electrician owns.
"""

STARTER_CATALOG = {
    "Cordless power tools": [
        ("Cordless hammer drill", "Milwaukee", "2904-20"),
        ("Right-angle drill", "Milwaukee", "2809-20"),
        ("Reciprocating saw", "Milwaukee", "2821-20"),
        ("Portable band saw", "Milwaukee", "2929-20"),
        ("Threaded rod cutter", "Milwaukee", "2872-20"),
        ("Angle grinder", "Milwaukee", "2880-20"),
    ],
    "Concrete drilling and fastening": [
        ("SDS Plus rotary hammer", "Milwaukee", "2912-20"),
        ("SDS Max rotary hammer", "Milwaukee", "2718-20"),
        ("Core drill with stand", "Milwaukee", "MXF301-2CXS"),
        ("Battery concrete nailer", "Hilti", "BX 3-ME-22"),
    ],
    "Test and measurement": [
        ("Digital multimeter", "Fluke", "87V MAX"),
        ("Clamp meter", "Fluke", "376 FC"),
        ("Insulation multimeter", "Fluke", "1587 FC"),
        ("Earth ground clamp", "Fluke", "1630-2 FC"),
        ("Power quality logger", "Fluke", "1738"),
        ("Phase rotation indicator", "Fluke", "9040"),
        ("Thermal camera", "Fluke", "TiS20+"),
    ],
    "Conduit bending": [
        ("3/4 in EMT hand bender", "Klein Tools", "51607"),
        ("1-1/4 in EMT hand bender head", "Greenlee", "843F"),
        ("Mechanical bender", "Greenlee", "1818"),
        ("Electric bender", "Greenlee", "555CX"),
        ("Hydraulic bender", "Greenlee", "881CT"),
    ],
    "Pipe threading": [
        ("Power drive threading machine", "RIDGID", "300"),
        ("Hand-held power drive", "RIDGID", "700"),
        ("Cordless pipe threader", "Milwaukee", "2874-22HD"),
    ],
    "Knockout and crimping": [
        ("Cordless knockout tool", "Milwaukee", "2677-21"),
        ("Ratchet knockout kit", "Greenlee", "7238SB"),
        ("Hydraulic knockout kit", "Greenlee", "7310SB"),
        ("Cordless crimper", "Milwaukee", "2679-22"),
        ("Cordless cable cutter", "Milwaukee", "2672-21"),
    ],
    "Wire pulling": [
        ("Small cable puller", "Greenlee", "G3"),
        ("Medium cable puller", "Southwire", "M3K-M"),
        ("Large cable puller", "Greenlee", "6001"),
        ("Reel jack stand", "Greenlee", "683"),
        ("Multi-reel wire cart", "Southwire", "PM06"),
    ],
    "Fishing and locating": [
        ("Power fish tape", "Milwaukee", "2873-20"),
        ("Vacuum fishing system", "Greenlee", "690-15"),
        ("Breaker finder", "Klein Tools", "ET450"),
        ("Wire tracer", "Fluke", "2052"),
        ("Wall and concrete scanner", "Bosch", "D-TECT200C"),
    ],
    "Ladders and lifts": [
        ("6 ft fiberglass stepladder", "Werner", "6206"),
        ("8 ft fiberglass stepladder", "Werner", "6208"),
        ("4 ft podium ladder", "Werner", "PD6204"),
        ("28 ft extension ladder", "Werner", "D6228-2"),
        ("Baker scaffold", "MetalTech", "I-CISC"),
        ("Scissor lift", "Genie", "GS-1930"),
        ("Vertical mast lift", "Genie", "GR-15"),
    ],
    "Layout and lasers": [
        ("3-plane line laser", "Milwaukee", "3632-21"),
        ("Rotary laser", "Milwaukee", "3701-21"),
        ("Laser distance meter", "Milwaukee", "48-22-9803"),
    ],
    "Power and lighting": [
        ("Inverter generator", "Honda", "EU2200i"),
        ("Large inverter generator", "Honda", "EU7000iS"),
        ("Battery power station", "Milwaukee", "MXF002-2XC"),
        ("Temporary power box", "Southwire", "19703R02"),
        ("Tower light", "Milwaukee", "2136-20"),
    ],
    "Safety equipment": [
        ("Arc flash suit kit, 40 cal", "Salisbury", "SK40RGL-PP"),
        ("Class 0 rubber glove kit", "Salisbury", "GK011R"),
        ("Fall-arrest harness", "3M DBI-SALA", "1113124"),
        ("Self-retracting lifeline", "3M DBI-SALA", "3101225"),
    ],
}


def add_starter_catalog(company_id, category_model, tool_model):
    """Add any starter category or model the company doesn't already have, matched by name.

    Takes the model classes so a data migration can pass its historical ones.
    """
    categories = {
        c.name.casefold(): c for c in category_model.objects.filter(company_id=company_id)
    }
    models = {
        name.casefold()
        for name in tool_model.objects.filter(company_id=company_id).values_list("name", flat=True)
    }
    for category_name, entries in STARTER_CATALOG.items():
        category = categories.get(category_name.casefold())
        if category is None:
            category = category_model.objects.create(company_id=company_id, name=category_name)
        tool_model.objects.bulk_create(
            tool_model(
                company_id=company_id,
                category=category,
                name=name,
                manufacturer=manufacturer,
                model_number=number,
            )
            for name, manufacturer, number in entries
            if name.casefold() not in models
        )
